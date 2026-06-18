import json
import os
import re
import sys
import urllib.error
import base64
import io

from account_verification_ai import (
    FRONT_ASSET_REGIONS,
    add_raw_bytes,
    clean_place_value,
    call_gemini_generate,
    compare_faces,
    file_by_type,
    gemini_api_keys,
    gemini_inline_part,
    gemini_model_candidates,
    image_from_file,
    load_optional_dependencies,
    normalize,
    normalize_id,
    normalize_name,
    parse_date,
    text_similarity,
)


PASSPORT_FIELD_REGIONS = {
    "mother_name": (0.49, 0.17, 0.79, 0.28),
    "registry": (0.51, 0.25, 0.89, 0.32),
    "profession": (0.52, 0.31, 0.78, 0.37),
    "signature": (0.48, 0.18, 0.79, 0.30),
    "passport_photo": (0.04, 0.63, 0.28, 0.91),
    "last_name": (0.29, 0.59, 0.42, 0.68),
    "passport_number": (0.58, 0.55, 0.78, 0.62),
    "can_number": (0.82, 0.55, 0.93, 0.62),
    "first_name": (0.29, 0.68, 0.44, 0.75),
    "father_name": (0.29, 0.74, 0.48, 0.81),
    "nationality": (0.29, 0.80, 0.50, 0.85),
    "place_of_birth": (0.29, 0.85, 0.50, 0.89),
    "issuance_date": (0.29, 0.89, 0.50, 0.93),
    "expiry_date": (0.29, 0.93, 0.50, 0.98),
    "date_of_birth": (0.51, 0.76, 0.72, 0.83),
    "gender": (0.77, 0.76, 0.87, 0.83),
    "mrz": (0.10, 0.79, 0.89, 0.94),
}

PASSPORT_ASSET_REGIONS = {
    "passport_photo": (0.04, 0.55, 0.28, 0.82),
    "signature": (0.48, 0.35, 0.79, 0.44),
    "mrz": (0.02, 0.85, 0.98, 0.98),
}


def crop_pil_to_base64_png(image, region):
    cropped = image.crop(
        (
            int(image.width * region[0]),
            int(image.height * region[1]),
            int(image.width * region[2]),
            int(image.height * region[3]),
        )
    )
    output = io.BytesIO()
    cropped.save(output, format="PNG")
    return base64.b64encode(output.getvalue()).decode("ascii")


def base64_png_to_file_record(data, file_name):
    return {
        "file_name": file_name,
        "content_base64": data,
        "raw_bytes": base64.b64decode(data),
    }


def file_by_any_type(files, document_types):
    return next((item for item in files if item.get("document_type") in document_types), None)


def preprocess_for_ocr(image, Image, cv2, scale=3):
    resized = image.resize(
        (max(1, image.width * scale), max(1, image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    gray = resized.convert("L")

    try:
        import numpy

        gray_array = numpy.array(gray)
        thresholded = cv2.threshold(gray_array, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
        return Image.fromarray(thresholded)
    except Exception:
        return gray


def ocr_passport_region(image, region, Image, pytesseract, cv2):
    cropped = image.crop(
        (
            int(image.width * region[0]),
            int(image.height * region[1]),
            int(image.width * region[2]),
            int(image.height * region[3]),
        )
    )
    processed = preprocess_for_ocr(cropped, Image, cv2, scale=3)
    text = pytesseract.image_to_string(processed, lang=os.environ.get("TESSERACT_LATIN_LANG", "eng"))
    return normalize(text)


def normalize_passport_canvas(image):
    if image.height > image.width * 1.25:
        top = int(image.height * 0.18)
        bottom = int(image.height * 0.92)
        return image.crop((0, top, image.width, bottom))

    return image


def parse_passport_registry(value):
    text = normalize(value)
    digits = re.findall(r"\d+", text)
    return {
        "registry_place": re.sub(r"\d+", "", text).strip(" -:/"),
        "registry_number": digits[-1] if digits else "",
    }


def parse_passport_gender(value):
    text = normalize(value).lower()
    if re.search(r"\b(f|female)\b", text):
        return "female"
    if re.search(r"\b(m|male)\b", text):
        return "male"
    return ""


def normalize_gemini_passport_fields(gemini_result):
    fields = gemini_result.get("fields") or {}
    extracted = {}
    raw_values = {}

    for field, value in fields.items():
        if isinstance(value, dict):
            extracted[field] = normalize(value.get("english") or value.get("value") or "")
            raw_values[field] = normalize(value.get("raw_arabic") or value.get("raw") or "")
        else:
            extracted[field] = normalize(value)

    extracted.update(
        {
            "first_name": normalize_name(extracted.get("first_name")),
            "last_name": normalize_name(extracted.get("last_name")),
            "father_name": normalize_name(extracted.get("father_name")),
            "mother_name": normalize_name(extracted.get("mother_name")),
            "date_of_birth": parse_date(extracted.get("date_of_birth")),
            "place_of_birth": clean_place_value(extracted.get("place_of_birth")) or extracted.get("place_of_birth", ""),
            "passport_number": normalize(extracted.get("passport_number")).replace(" ", ""),
            "can_number": normalize_id(extracted.get("can_number")),
            "registry_number": normalize_id(extracted.get("registry_number")),
            "issuance_date": parse_date(extracted.get("issuance_date")),
            "expiry_date": parse_date(extracted.get("expiry_date")),
            "gender": parse_passport_gender(extracted.get("gender")),
            "_ocr_provider": "gemini",
            "_ocr_model": gemini_result.get("_model", ""),
        }
    )

    if raw_values:
        extracted["_raw_passport"] = raw_values

    return extracted


def call_gemini_passport_ocr(passport_file):
    api_keys = gemini_api_keys()
    if not api_keys or not passport_file:
        return None, "Gemini passport OCR is not configured."

    prompt = """
You are extracting data from a Lebanese biometric passport image.
Read only the uploaded passport. Return only valid JSON. If a field is unreadable, return an empty string.

Return this exact shape:
{
  "fields": {
    "first_name": {"raw": "", "english": ""},
    "last_name": {"raw": "", "english": ""},
    "father_name": {"raw": "", "english": ""},
    "mother_name": {"raw": "", "english": ""},
    "date_of_birth": {"raw": "", "english": ""},
    "place_of_birth": {"raw": "", "english": ""},
    "gender": {"raw": "", "english": ""},
    "nationality": {"raw": "", "english": ""},
    "passport_number": {"raw": "", "english": ""},
    "can_number": {"raw": "", "english": ""},
    "registry_place": {"raw": "", "english": ""},
    "registry_number": {"raw": "", "english": ""},
    "profession": {"raw": "", "english": ""},
    "issuance_date": {"raw": "", "english": ""},
    "expiry_date": {"raw": "", "english": ""}
  },
  "notes": ""
}

Normalize dates to YYYY-MM-DD, names and places to common English spelling, sex to Male/Female,
and keep passport/CAN/registry numbers as visible digits or letters.
""".strip()
    parts = [
        {"text": prompt + "\n\nPASSPORT IMAGE:"},
        gemini_inline_part(passport_file, "image/jpeg"),
    ]
    errors = []

    for key_index, api_key in enumerate(api_keys, start=1):
        for model in gemini_model_candidates("GEMINI_PASSPORT_OCR_MODEL"):
            try:
                parsed_json = call_gemini_generate(model, api_key, parts)
            except urllib.error.HTTPError as error:
                details = error.read().decode("utf-8", errors="ignore")
                errors.append(f"key {key_index} {model}: HTTP {error.code} {details[:140]}")
                continue
            except Exception as error:
                errors.append(f"key {key_index} {model}: {error}")
                continue

            if parsed_json:
                parsed_json["_model"] = model
                parsed_json["_key_index"] = key_index
                return parsed_json, ""

            errors.append(f"key {key_index} {model}: invalid JSON")

    return None, "Gemini passport OCR request failed. " + " | ".join(errors[:3])


def file_mime_type(file_record, fallback="image/png"):
    file_name = str(file_record.get("file_name") or "").lower()

    if file_name.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if file_name.endswith(".webp"):
        return "image/webp"
    if file_name.endswith(".png"):
        return "image/png"

    return fallback


def call_gemini_visual_match(left_file, right_file, prompt, model_env_name):
    api_keys = gemini_api_keys()
    if not api_keys or not left_file or not right_file:
        return None, "Gemini visual comparison is not configured."

    parts = [
        {"text": prompt},
        {"text": "IMAGE A:"},
        gemini_inline_part(left_file, file_mime_type(left_file)),
        {"text": "IMAGE B:"},
        gemini_inline_part(right_file, file_mime_type(right_file)),
    ]
    errors = []

    for key_index, api_key in enumerate(api_keys, start=1):
        for model in gemini_model_candidates(model_env_name):
            try:
                parsed_json = call_gemini_generate(model, api_key, parts)
            except urllib.error.HTTPError as error:
                details = error.read().decode("utf-8", errors="ignore")
                errors.append(f"key {key_index} {model}: HTTP {error.code} {details[:140]}")
                continue
            except Exception as error:
                errors.append(f"key {key_index} {model}: {error}")
                continue

            if parsed_json:
                score = parsed_json.get("score")
                try:
                    parsed_json["score"] = max(0.0, min(100.0, float(score)))
                except (TypeError, ValueError):
                    parsed_json["score"] = None
                parsed_json["_model"] = model
                parsed_json["_key_index"] = key_index
                return parsed_json, ""

            errors.append(f"key {key_index} {model}: invalid JSON")

    return None, "Gemini visual comparison failed. " + " | ".join(errors[:3])


def gemini_signature_score(passport_signature_base64, national_id_signature_base64):
    return call_gemini_visual_match(
        base64_png_to_file_record(passport_signature_base64, "passport-signature.png"),
        base64_png_to_file_record(national_id_signature_base64, "national-id-signature.png"),
        """
Compare these two handwritten signature crops. Return only JSON:
{"score": 0, "same_signature": false, "notes": ""}

Use score 0-100. Score high only if the handwriting/signature strokes appear to be from the same signer.
Ignore background color, document texture, crop size, and compression artifacts.
""".strip(),
        "GEMINI_SIGNATURE_MATCH_MODEL",
    )


def gemini_face_score(passport_face_base64, photo_file):
    return call_gemini_visual_match(
        base64_png_to_file_record(passport_face_base64, "passport-face.png"),
        photo_file,
        """
Compare the face in IMAGE A with the face in IMAGE B. Return only JSON:
{"score": 0, "same_person": false, "notes": ""}

Use score 0-100. Consider age difference, lighting, glasses, pose, and image quality, but do not mark
two clearly different people as a match.
""".strip(),
        "GEMINI_FACE_MATCH_MODEL",
    )


def passport_values_match(expected, actual, comparison_type, field):
    expected_text = normalize(expected)
    actual_text = normalize(actual)

    if not expected_text or not actual_text:
        return False

    if comparison_type == "name":
        expected_compact = re.sub(r"[^a-z0-9]", "", expected_text.lower())
        actual_compact = re.sub(r"[^a-z0-9]", "", actual_text.lower())
        expected_tokens = [token for token in re.split(r"\s+", expected_text.lower()) if token]
        actual_tokens = [token for token in re.split(r"\s+", actual_text.lower()) if token]

        if expected_compact == actual_compact:
            return True

        if field == "father_name" and expected_tokens and actual_tokens:
            if text_similarity(expected_tokens[0], actual_tokens[0], "name") >= 0.72:
                return True

        if expected_tokens and actual_tokens:
            if text_similarity(expected_tokens[0], actual_tokens[0], "name") >= 0.78:
                if len(actual_tokens) == 1 or len(expected_tokens) == 1:
                    return True

        return text_similarity(expected_text, actual_text, "name") >= 0.72

    return text_similarity(expected_text, actual_text, comparison_type) >= 0.82


def passport_local_ocr_match_count(application, user, extracted):
    checks = [
        ("first_name", user.get("first_name") or application.get("first_name"), extracted.get("first_name"), "name"),
        ("last_name", user.get("last_name") or application.get("last_name"), extracted.get("last_name"), "name"),
        ("father_name", user.get("father_name") or application.get("father_name"), extracted.get("father_name"), "name"),
        ("mother_name", user.get("mother_name") or application.get("mother_name"), extracted.get("mother_name"), "name"),
        ("date_of_birth", user.get("date_of_birth") or application.get("date_of_birth"), extracted.get("date_of_birth"), "date"),
        ("passport_number", application.get("passport_number"), extracted.get("passport_number"), "national_id_number"),
        ("can_number", application.get("can_number"), extracted.get("can_number"), "national_id_number"),
        ("registry_number", application.get("registry_number"), extracted.get("registry_number"), "national_id_number"),
    ]

    return sum(
        1
        for field, expected, actual, comparison_type in checks
        if expected and actual and passport_values_match(expected, actual, comparison_type, field)
    )


def blank_low_confidence_passport_fields(extracted):
    for field in [
        "first_name",
        "last_name",
        "father_name",
        "mother_name",
        "date_of_birth",
        "place_of_birth",
        "gender",
        "nationality",
        "passport_number",
        "can_number",
        "registry_place",
        "registry_number",
        "profession",
        "issuance_date",
        "expiry_date",
        "mrz",
    ]:
        extracted[field] = ""


def signature_similarity_score(left_image, right_image, cv2, numpy):
    left_gray = cv2.cvtColor(numpy.array(left_image.convert("RGB")), cv2.COLOR_RGB2GRAY)
    right_gray = cv2.cvtColor(numpy.array(right_image.convert("RGB")), cv2.COLOR_RGB2GRAY)
    left_gray = cv2.resize(left_gray, (240, 80))
    right_gray = cv2.resize(right_gray, (240, 80))
    _, left_binary = cv2.threshold(left_gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    _, right_binary = cv2.threshold(right_gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    left_hist = cv2.calcHist([left_binary], [0], None, [32], [0, 256])
    right_hist = cv2.calcHist([right_binary], [0], None, [32], [0, 256])
    cv2.normalize(left_hist, left_hist)
    cv2.normalize(right_hist, right_hist)
    hist_score = max(0.0, min(1.0, (float(cv2.compareHist(left_hist, right_hist, cv2.HISTCMP_CORREL)) + 1.0) / 2.0))
    diff = cv2.absdiff(left_binary, right_binary)
    mse = float(numpy.mean(diff ** 2))
    mse_score = max(0.0, min(1.0, 1.0 - (mse / 18000.0)))
    return max(0.0, min(1.0, hist_score * 0.55 + mse_score * 0.45))


def analyze_passport_application(payload):
    Image, pytesseract, cv2, numpy, missing_dependencies = load_optional_dependencies()
    application = payload.get("application") or {}
    user = payload.get("user") or {}
    files = add_raw_bytes(payload.get("files") or [])
    account_files = add_raw_bytes(payload.get("account_files") or [])

    failures = []
    warnings = []
    extracted = {}
    extracted_assets = {}
    ocr_regions = {}

    if missing_dependencies:
        warnings.append(
            "Passport OCR dependencies are not fully available: " + ", ".join(sorted(missing_dependencies))
        )

    passport_file = file_by_any_type(files, {"old_passport_copy", "passport_document", "passport"})
    photo_file = file_by_type(files, "photo_id")
    account_id_front = file_by_type(account_files, "national_id_front")

    if passport_file:
        gemini_passport_result, gemini_error = call_gemini_passport_ocr(passport_file)
        if gemini_passport_result:
            extracted.update(normalize_gemini_passport_fields(gemini_passport_result))
            if gemini_passport_result.get("notes"):
                warnings.append(str(gemini_passport_result["notes"]))
        elif gemini_api_keys() and gemini_error:
            extracted["_gemini_ocr_error"] = gemini_error

    if passport_file and not missing_dependencies:
        passport_asset_image = image_from_file(passport_file, Image)
        if passport_asset_image is not None:
            extracted_assets["passport_photo"] = crop_pil_to_base64_png(
                passport_asset_image,
                PASSPORT_ASSET_REGIONS["passport_photo"],
            )
            extracted_assets["signature"] = crop_pil_to_base64_png(
                passport_asset_image,
                PASSPORT_ASSET_REGIONS["signature"],
            )
            extracted_assets["mrz"] = crop_pil_to_base64_png(
                passport_asset_image,
                PASSPORT_ASSET_REGIONS["mrz"],
            )

    if account_id_front and not missing_dependencies:
        account_front_asset_image = image_from_file(account_id_front, Image)
        if account_front_asset_image is not None:
            extracted_assets["national_id_signature"] = crop_pil_to_base64_png(
                account_front_asset_image,
                FRONT_ASSET_REGIONS["signature"],
            )

    if passport_file and not missing_dependencies and not extracted.get("_ocr_provider"):
        passport_image = image_from_file(passport_file, Image)
        if passport_image is None:
            warnings.append("The uploaded old passport image could not be opened.")
        else:
            passport_image = normalize_passport_canvas(passport_image)
            for field, region in PASSPORT_FIELD_REGIONS.items():
                if field in {"signature", "passport_photo"}:
                    continue
                region_text = ocr_passport_region(passport_image, region, Image, pytesseract, cv2)
                ocr_regions[field] = region_text

            registry = parse_passport_registry(ocr_regions.get("registry", ""))
            extracted.update(
                {
                    "first_name": normalize_name(ocr_regions.get("first_name")),
                    "last_name": normalize_name(ocr_regions.get("last_name")),
                    "father_name": normalize_name(ocr_regions.get("father_name")),
                    "mother_name": normalize_name(ocr_regions.get("mother_name")),
                    "date_of_birth": parse_date(ocr_regions.get("date_of_birth")),
                    "place_of_birth": clean_place_value(ocr_regions.get("place_of_birth")),
                    "nationality": normalize(ocr_regions.get("nationality")),
                    "passport_number": normalize(ocr_regions.get("passport_number")).replace(" ", ""),
                    "can_number": normalize_id(ocr_regions.get("can_number")),
                    "registry_place": registry["registry_place"],
                    "registry_number": registry["registry_number"],
                    "profession": normalize(ocr_regions.get("profession")),
                    "issuance_date": parse_date(ocr_regions.get("issuance_date")),
                    "expiry_date": parse_date(ocr_regions.get("expiry_date")),
                    "gender": parse_passport_gender(ocr_regions.get("gender")),
                    "mrz": ocr_regions.get("mrz", "").replace(" ", ""),
                    "_ocr_provider": "local_tesseract",
                }
            )

            if passport_local_ocr_match_count(application, user, extracted) < 3:
                blank_low_confidence_passport_fields(extracted)
                extracted["_ocr_confidence"] = "low"
                warnings.append(
                    "Gemini passport OCR is temporarily unavailable and local passport OCR was not reliable enough. Staff review is required."
                )
    elif not passport_file and application.get("application_type") == "renewal":
        warnings.append("Old passport image is required for renewal OCR but was not available.")

    comparison_rows = [
        ("first_name", user.get("first_name") or application.get("first_name"), extracted.get("first_name"), "name"),
        ("last_name", user.get("last_name") or application.get("last_name"), extracted.get("last_name"), "name"),
        ("father_name", user.get("father_name") or application.get("father_name"), extracted.get("father_name"), "name"),
        ("mother_name", user.get("mother_name") or application.get("mother_name"), extracted.get("mother_name"), "name"),
        ("date_of_birth", user.get("date_of_birth") or application.get("date_of_birth"), extracted.get("date_of_birth"), "date"),
        ("place_of_birth", user.get("place_of_birth") or application.get("place_of_birth"), extracted.get("place_of_birth"), "place_of_birth"),
        ("gender", user.get("gender") or application.get("gender"), extracted.get("gender"), "gender"),
        ("passport_number", application.get("passport_number"), extracted.get("passport_number"), "national_id_number"),
        ("can_number", application.get("can_number"), extracted.get("can_number"), "national_id_number"),
        ("registry_number", application.get("registry_number"), extracted.get("registry_number"), "national_id_number"),
        ("issuance_date", application.get("issuance_date"), extracted.get("issuance_date"), "date"),
        ("expiry_date", application.get("expiry_date"), extracted.get("expiry_date"), "date"),
    ]

    if extracted.get("_ocr_confidence") != "low":
        for field, expected, actual, comparison_type in comparison_rows:
            if not expected or not actual:
                if expected and passport_file:
                    warnings.append(f"Could not compare {field.replace('_', ' ')} because OCR did not extract it.")
                continue
            if not passport_values_match(expected, actual, comparison_type, field):
                warnings.append(f"{field.replace('_', ' ').title()} does not match the uploaded passport document.")

    if photo_file and not missing_dependencies:
        face_score = None
        face_error = ""
        if extracted_assets.get("passport_photo"):
            gemini_face, gemini_face_error = gemini_face_score(extracted_assets["passport_photo"], photo_file)
            if gemini_face and gemini_face.get("score") is not None:
                face_score = gemini_face["score"] / 100.0
                extracted["passport_photo_face_match_score"] = round(gemini_face["score"], 1)
                extracted["passport_photo_face_match_provider"] = "gemini"
                if gemini_face.get("notes"):
                    extracted["passport_photo_face_match_notes"] = normalize(gemini_face.get("notes"))
            elif gemini_face_error and gemini_api_keys():
                extracted["passport_photo_face_match_notes"] = f"{gemini_face_error} Falling back to local face comparison."

        if face_score is None and account_id_front:
            face_score, face_error = compare_faces(account_id_front, photo_file, Image, cv2, numpy)
            if not face_error:
                extracted["passport_photo_face_match_score"] = round(face_score * 100, 1)
                extracted["passport_photo_face_match_provider"] = "local"

        if face_error:
            warnings.append(f"{face_error} Staff review is required.")
        elif face_score is not None and face_score < 0.62:
            warnings.append("Photo ID face requires staff review against the uploaded passport photo.")
    elif not photo_file:
        failures.append("Photo ID is missing.")

    if passport_file and account_id_front and not missing_dependencies:
        passport_image = image_from_file(passport_file, Image)
        account_front_image = image_from_file(account_id_front, Image)
        if passport_image is not None and account_front_image is not None:
            passport_signature = passport_image.crop(
                (
                    int(passport_image.width * PASSPORT_ASSET_REGIONS["signature"][0]),
                    int(passport_image.height * PASSPORT_ASSET_REGIONS["signature"][1]),
                    int(passport_image.width * PASSPORT_ASSET_REGIONS["signature"][2]),
                    int(passport_image.height * PASSPORT_ASSET_REGIONS["signature"][3]),
                )
            )
            account_signature = account_front_image.crop(
                (
                    int(account_front_image.width * FRONT_ASSET_REGIONS["signature"][0]),
                    int(account_front_image.height * FRONT_ASSET_REGIONS["signature"][1]),
                    int(account_front_image.width * FRONT_ASSET_REGIONS["signature"][2]),
                    int(account_front_image.height * FRONT_ASSET_REGIONS["signature"][3]),
                )
            )
            signature_score = None
            if extracted_assets.get("signature") and extracted_assets.get("national_id_signature"):
                gemini_signature, gemini_signature_error = gemini_signature_score(
                    extracted_assets["signature"],
                    extracted_assets["national_id_signature"],
                )
                if gemini_signature and gemini_signature.get("score") is not None:
                    signature_score = gemini_signature["score"] / 100.0
                    extracted["signature_match_score"] = round(gemini_signature["score"], 1)
                    extracted["signature_match_provider"] = "gemini"
                    if gemini_signature.get("notes"):
                        extracted["signature_match_notes"] = normalize(gemini_signature.get("notes"))
                elif gemini_signature_error and gemini_api_keys():
                    extracted["signature_match_notes"] = f"{gemini_signature_error} Falling back to local signature comparison."

            if signature_score is None:
                signature_score = signature_similarity_score(passport_signature, account_signature, cv2, numpy)
                extracted["signature_match_score"] = round(signature_score * 100, 1)
                extracted["signature_match_provider"] = "local"

            if signature_score < 0.45:
                warnings.append("Passport signature requires staff review against the verified national ID signature.")

    status = "ai_verified" if not failures and not warnings else "pending_ai_review"
    score = max(0, min(100, 100 - len(failures) * 18 - len(warnings) * 8))

    notes = [
        f"Passport AI status: {status}",
        f"Score: {score}/100",
        failures and "Failed checks: " + "; ".join(failures),
        warnings and "Warnings: " + "; ".join(warnings),
    ]

    return {
        "score": score,
        "status": status,
        "failures": failures,
        "warnings": warnings,
        "notes": "\n".join([note for note in notes if note]),
        "extracted": extracted,
        "ocr_text": ocr_regions,
        "extracted_assets": extracted_assets,
    }


def main():
    try:
        request = json.load(sys.stdin)
        result = analyze_passport_application(request.get("payload") or {})
        print(json.dumps({"ok": True, "result": result}))
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
