#!/usr/bin/env python3
import base64
import difflib
import io
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime


TEXT_FIELDS = [
    "first_name",
    "last_name",
    "father_name",
    "mother_name",
    "date_of_birth",
    "place_of_birth",
    "national_id_number",
    "gender",
    "governorate",
    "blood_type",
    "marital_status",
    "registry_number",
]

ARABIC_CHAR_PATTERN = re.compile(r"[\u0600-\u06ff]")

ARABIC_TRANSLITERATION = {
    "ا": "a",
    "أ": "a",
    "إ": "i",
    "آ": "a",
    "ب": "b",
    "ت": "t",
    "ث": "th",
    "ج": "j",
    "ح": "h",
    "خ": "kh",
    "د": "d",
    "ذ": "dh",
    "ر": "r",
    "ز": "z",
    "س": "s",
    "ش": "sh",
    "ص": "s",
    "ض": "d",
    "ط": "t",
    "ظ": "z",
    "ع": "a",
    "غ": "gh",
    "ف": "f",
    "ق": "q",
    "ك": "k",
    "ل": "l",
    "م": "m",
    "ن": "n",
    "ه": "h",
    "ة": "h",
    "و": "w",
    "ؤ": "w",
    "ي": "y",
    "ى": "a",
    "ئ": "y",
    "ء": "",
    "لا": "la",
}

ARABIC_GENDER_MAP = {
    "ذكر": "male",
    "رجل": "male",
    "أنثى": "female",
    "انثى": "female",
    "امرأة": "female",
}

ARABIC_GOVERNORATE_MAP = {
    "بيروت": "beirut",
    "جبل لبنان": "mount_lebanon",
    "الشمال": "north_lebanon",
    "شمال لبنان": "north_lebanon",
    "عكار": "akkar",
    "البقاع": "beqaa",
    "بعلبك الهرمل": "baalbek_hermel",
    "الجنوب": "south_lebanon",
    "جنوب لبنان": "south_lebanon",
    "النبطية": "nabatieh",
}

GOVERNORATE_FUZZY_KEYS = {
    "nbtyh": "nabatieh",
    "nbth": "nabatieh",
    "bt yh": "nabatieh",
    "btyh": "nabatieh",
    "alnbtyh": "nabatieh",
    "altbtyh": "nabatieh",
    "alstyh": "nabatieh",
    "alshytyh": "nabatieh",
    "alshth": "nabatieh",
    "styh": "nabatieh",
    "shytyh": "nabatieh",
    "شطية": "nabatieh",
    "سطية": "nabatieh",
    "byrwt": "beirut",
    "jbl lbnan": "mount_lebanon",
    "shmal": "north_lebanon",
    "akar": "akkar",
    "bkaa": "beqaa",
    "baklbk": "baalbek_hermel",
    "jnwb": "south_lebanon",
}

ARABIC_MARITAL_STATUS_MAP = {
    "اعزب": "single",
    "عازب": "single",
    "عزباء": "single",
    "متاهل": "married",
    "متزوج": "married",
    "متزوجه": "married",
    "مطلق": "divorced",
    "مطلقه": "divorced",
    "ارمل": "widowed",
    "ارمله": "widowed",
}

ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")

ARABIC_DISPLAY_OVERRIDES = {
    "محمد": "Mohammed",
    "محمذ": "Mohammed",
    "محم": "Mohammed",
    "احمد": "Ahmad",
    "علي": "Ali",
    "عباس": "Abbas",
    "عبد": "Abd",
    "الكريم": "Al Karim",
    "عبد الكريم": "Abdel Karim",
    "عبدالكريم": "Abdel Karim",
    "مريم": "Mariam",
    "مرتم": "Mariam",
    "ميريم": "Mariam",
    "اميره": "Amira",
    "اميرة": "Amira",
    "كوثر": "Kawthar",
    "ياسين": "Yassine",
    "زيتون": "Zaytoun",
    "زيتول": "Zaytoun",
    "عرب صاليم": "Arab Salim",
    "النبطيه": "Nabatieh",
    "النبطية": "Nabatieh",
}


def load_optional_dependencies():
    missing = []

    try:
        from PIL import Image
    except Exception:
        Image = None
        missing.append("Pillow")

    try:
        import pytesseract
        if os.environ.get("TESSERACT_CMD"):
            pytesseract.pytesseract.tesseract_cmd = os.environ["TESSERACT_CMD"]
    except Exception:
        pytesseract = None
        missing.append("pytesseract")

    try:
        import cv2
    except Exception:
        cv2 = None
        missing.append("opencv-python")

    try:
        import numpy
    except Exception:
        numpy = None
        missing.append("numpy")

    return Image, pytesseract, cv2, numpy, missing


def normalize(value):
    return re.sub(r"\s+", " ", str(value or "").strip()).lower()


def normalize_arabic(value, collapse_spaces=True):
    text = str(value or "").translate(ARABIC_DIGITS)
    replacements = {
        "أ": "ا",
        "إ": "ا",
        "آ": "ا",
        "ى": "ي",
        "ة": "ه",
        "ؤ": "و",
        "ئ": "ي",
        "\u0640": "",
        "\u200e": "",
        "\u200f": "",
        "\u202a": "",
        "\u202b": "",
        "\u202c": "",
    }

    for source, target in replacements.items():
        text = text.replace(source, target)

    text = re.sub(r"[\u064b-\u065f]", "", text)

    if collapse_spaces:
        return re.sub(r"\s+", " ", text).strip()

    return re.sub(r"[ \t]+", " ", text).strip()


def transliterate_arabic(value):
    text = normalize_arabic(value)

    for source, target in sorted(ARABIC_TRANSLITERATION.items(), key=lambda item: len(item[0]), reverse=True):
        text = text.replace(source, target)

    return re.sub(r"[^a-z]", "", text.lower())


def transliterate_arabic_for_display(value):
    text = strip_known_arabic_labels(value)
    text = normalize_arabic(text)

    for source, target in sorted(ARABIC_DISPLAY_OVERRIDES.items(), key=lambda item: len(item[0]), reverse=True):
        text = re.sub(rf"\b{re.escape(normalize_arabic(source))}\b", target, text)

    parts = []
    for token in re.split(r"\s+", text):
        if not token:
            continue
        if re.search(r"[A-Za-z]", token):
            parts.append(token)
        elif ARABIC_CHAR_PATTERN.search(token):
            transliterated = transliterate_arabic(token)
            parts.append(transliterated.capitalize() if transliterated else "")
        else:
            parts.append(token)

    return re.sub(r"\s+", " ", " ".join(part for part in parts if part)).strip()


def translate_arabic_value(value, field):
    text = normalize_arabic(value)

    if field == "gender":
        compact_text = re.sub(r"\s+", "", text)
        if "ذكر" in compact_text or "لذكر" in compact_text:
            return "male"
        if "انثى" in compact_text or "انتي" in compact_text:
            return "female"

        for arabic_value, english_value in ARABIC_GENDER_MAP.items():
            if normalize_arabic(arabic_value) in text:
                return english_value
        return ""

    if field == "governorate":
        for arabic_value, english_value in ARABIC_GOVERNORATE_MAP.items():
            if normalize_arabic(arabic_value) in text:
                return english_value

        transliterated = transliterate_arabic(text)
        for fuzzy_key, english_value in GOVERNORATE_FUZZY_KEYS.items():
            compact_key = fuzzy_key.replace(" ", "")
            if compact_key in transliterated or compact_key in normalize_arabic(text).replace(" ", ""):
                return english_value

        return ""

    if field == "marital_status":
        compact_text = re.sub(r"\s+", "", text)
        if "اعزب" in compact_text or "اعز" in compact_text:
            return "single"
        if "متزوج" in compact_text or "متاهل" in compact_text:
            return "married"

        for arabic_value, english_value in ARABIC_MARITAL_STATUS_MAP.items():
            if normalize_arabic(arabic_value) in text:
                return english_value
        return ""

    if ARABIC_CHAR_PATTERN.search(text):
        return transliterate_arabic(text)

    return value


def translate_extracted_for_display(user, extracted):
    translated = dict(extracted)
    raw_arabic = {}

    for field in ("first_name", "last_name", "father_name", "mother_name"):
        value = extracted.get(field)

        if not value:
            continue

        if ARABIC_CHAR_PATTERN.search(str(value)):
            raw_arabic[field] = normalize_arabic(value)
            translated[field] = transliterate_arabic_for_display(value)

    for field in ("gender", "governorate", "marital_status"):
        translated[field] = translate_arabic_value(extracted.get(field), field) or extracted.get(field, "")

    if extracted.get("place_of_birth"):
        if ARABIC_CHAR_PATTERN.search(str(extracted.get("place_of_birth"))):
            raw_arabic["place_of_birth"] = normalize_arabic(extracted.get("place_of_birth"))
        translated["place_of_birth"] = (
            translate_arabic_value(extracted.get("place_of_birth"), "governorate")
            or transliterate_arabic_for_display(extracted.get("place_of_birth"))
            or extracted.get("place_of_birth")
        )

    if raw_arabic:
        translated["_raw_arabic"] = raw_arabic
        translated["_translation_method"] = "local_arabic_ocr_to_english"

    return translated


def normalize_name(value):
    if ARABIC_CHAR_PATTERN.search(str(value or "")):
        return transliterate_arabic(value)

    return re.sub(r"[^a-z]", "", normalize(value))


def phonetic_name_key(value):
    text = normalize_name(value)
    replacements = {
        "ou": "w",
        "oo": "w",
        "ee": "y",
        "ie": "y",
        "ei": "y",
        "th": "th",
        "ss": "s",
        "mm": "m",
        "dd": "d",
    }

    for source, target in replacements.items():
        text = text.replace(source, target)

    return re.sub(r"[aeiou]", "", text)


def normalize_location_key(value):
    text = normalize_name(value)
    replacements = {
        " al ": " ",
        " el ": " ",
        " the ": " ",
        "kafar": "kfar",
        "kfer": "kfar",
        "tibneet": "tibnit",
        "tibneit": "tibnit",
        "nabatiyeh": "nabatieh",
        "nabatiye": "nabatieh",
    }

    text = f" {text} "
    for source, target in replacements.items():
        text = text.replace(source, target)

    return re.sub(r"\s+", "", text.strip())


def edit_distance(left, right, max_distance=3):
    if left == right:
        return 0

    if abs(len(left) - len(right)) > max_distance:
        return max_distance + 1

    previous = list(range(len(right) + 1))

    for left_index, left_character in enumerate(left, start=1):
        current = [left_index]
        row_minimum = current[0]

        for right_index, right_character in enumerate(right, start=1):
            cost = 0 if left_character == right_character else 1
            current.append(
                min(
                    previous[right_index] + 1,
                    current[right_index - 1] + 1,
                    previous[right_index - 1] + cost,
                )
            )
            row_minimum = min(row_minimum, current[-1])

        if row_minimum > max_distance:
            return max_distance + 1

        previous = current

    return previous[-1]


def name_is_minor_variant(expected_value, actual_value, expected_phonetic, actual_phonetic, field):
    if not expected_value or not actual_value:
        return False

    if edit_distance(expected_value, actual_value, 1) <= 1:
        return True

    if expected_phonetic and actual_phonetic and edit_distance(expected_phonetic, actual_phonetic, 1) <= 1:
        return True

    if field == "last_name":
        longest = max(len(expected_value), len(actual_value))

        if longest >= 7 and edit_distance(expected_value, actual_value, 2) <= 2:
            return True

        if (
            max(len(expected_phonetic), len(actual_phonetic)) >= 4
            and edit_distance(expected_phonetic, actual_phonetic, 2) <= 2
        ):
            return True

    return False


def normalize_id(value):
    return re.sub(r"\D+", "", str(value or "").translate(ARABIC_DIGITS))


def normalize_enum_value(value):
    return re.sub(r"[^a-z0-9]+", "_", normalize(value)).strip("_")


def parse_date(value):
    raw = str(value or "").translate(ARABIC_DIGITS).strip()
    if not raw:
        return ""

    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw[:10], fmt).date().isoformat()
        except ValueError:
            pass

    match = re.search(r"(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})", raw)
    if match:
      day, month, year = match.groups()
      try:
          return date(int(year), int(month), int(day)).isoformat()
      except ValueError:
          return ""

    return ""


def text_similarity(expected, actual, field):
    actual = translate_arabic_value(actual, field) or actual

    if field == "national_id_number":
        return 1.0 if normalize_id(expected) == normalize_id(actual) and normalize_id(expected) else 0.0

    if field == "date_of_birth":
        return 1.0 if parse_date(expected) == parse_date(actual) and parse_date(expected) else 0.0

    if field == "place_of_birth":
        expected_value = normalize_location_key(translate_arabic_value(expected, "governorate") or expected)
        actual_value = normalize_location_key(translate_arabic_value(actual, "governorate") or actual)

        if not expected_value or not actual_value:
            return 0.0

        if expected_value == actual_value:
            return 1.0

        if expected_value in actual_value or actual_value in expected_value:
            return 0.92

        return max(
            difflib.SequenceMatcher(None, expected_value, actual_value).ratio(),
            difflib.SequenceMatcher(
                None,
                phonetic_name_key(expected_value),
                phonetic_name_key(actual_value),
            ).ratio(),
        )

    if field in {"gender", "governorate"}:
        expected_value = normalize_enum_value(translate_arabic_value(expected, field) or expected)
        actual_value = normalize_enum_value(translate_arabic_value(actual, field) or actual)

        return 1.0 if expected_value == actual_value and expected_value else 0.0

    if field.endswith("name"):
        expected_text = str(expected or "")
        if field == "father_name":
            expected_text = expected_text.split()[0] if expected_text.split() else expected_text
            actual_parts = str(actual or "").split()
            actual = actual_parts[0] if actual_parts else actual

        expected_value = normalize_name(expected_text)
        actual_value = normalize_name(actual)
        expected_phonetic = phonetic_name_key(expected_text)
        actual_phonetic = phonetic_name_key(actual)

        if not expected_value or not actual_value:
            return 0.0

        if name_is_minor_variant(
            expected_value,
            actual_value,
            expected_phonetic,
            actual_phonetic,
            field,
        ):
            return 1.0

        return max(
            difflib.SequenceMatcher(None, expected_value, actual_value).ratio(),
            difflib.SequenceMatcher(None, expected_phonetic, actual_phonetic).ratio(),
        )

    expected_value = normalize(expected)
    actual_value = normalize(actual)

    if not expected_value or not actual_value:
        return 0.0

    return difflib.SequenceMatcher(None, expected_value, actual_value).ratio()


def file_by_type(files, document_type):
    return next((item for item in files if item.get("document_type") == document_type), None)


def file_by_any_type(files, document_types):
    return next((item for item in files if item.get("document_type") in document_types), None)


def image_from_file(file_record, Image):
    if not file_record or not file_record.get("content_base64"):
        return None

    content = base64.b64decode(file_record["content_base64"])
    return Image.open(io.BytesIO(content)).convert("RGB")


def ocr_image(file_record, Image, pytesseract, cv2, numpy):
    image = image_from_file(file_record, Image)
    if image is None:
        return ""

    cv_image = pil_to_cv_image(image, cv2, numpy)
    variants = [image]

    for angle in (0, 90, 180, 270):
        rotated = cv_image if angle == 0 else rotate_cv_image(cv_image, angle, cv2)
        gray = cv2.cvtColor(rotated, cv2.COLOR_BGR2GRAY)
        gray = normalize_image_size(gray, cv2)
        denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(denoised)
        binary = cv2.adaptiveThreshold(
            clahe,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            41,
            13,
        )
        otsu = cv2.threshold(clahe, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]

        variants.extend(
            [
                Image.fromarray(gray),
                Image.fromarray(clahe),
                Image.fromarray(binary),
                Image.fromarray(otsu),
            ]
        )

    configs = [
        "--oem 1 --psm 6",
        "--oem 1 --psm 4",
        "--oem 1 --psm 11",
        "--oem 1 --psm 3",
        "--oem 1 --psm 12",
    ]
    results = []

    for variant in variants:
        for config in configs:
            try:
                text = pytesseract.image_to_string(variant, lang="ara+eng", config=config)
                if text.strip():
                    results.append(text)
            except Exception:
                pass

    return max(results, key=ocr_text_quality, default="")


def normalize_image_size(gray, cv2):
    height, width = gray.shape[:2]
    longest_side = max(height, width)

    if longest_side < 1800:
        scale = 1800 / longest_side
    elif longest_side > 3200:
        scale = 3200 / longest_side
    else:
        scale = 1

    if scale == 1:
        return gray

    return cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)


def rotate_cv_image(image, angle, cv2):
    if angle == 90:
        return cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
    if angle == 180:
        return cv2.rotate(image, cv2.ROTATE_180)
    if angle == 270:
        return cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)

    return image


def orientation_score(text):
    normalized_text = normalize_arabic(text)
    labels = [
        "الاسم",
        "الشهره",
        "اسم الاب",
        "اسم الام",
        "تاريخ الولاده",
        "محل الولاده",
        "فئه الدم",
        "الجنس",
        "الوضع العايلي",
        "رقم السجل",
        "المحافظه",
    ]

    return sum(1 for label in labels if normalize_arabic(label) in normalized_text) + len(normalized_text) / 500


def best_oriented_cv_image(file_record, Image, pytesseract, cv2, numpy):
    image = image_from_file(file_record, Image)

    if image is None:
        return None

    cv_image = pil_to_cv_image(image, cv2, numpy)
    best_image = cv_image
    best_score = -1

    for angle in (0, 90, 180, 270):
        rotated = cv_image if angle == 0 else rotate_cv_image(cv_image, angle, cv2)
        gray = normalize_image_size(cv2.cvtColor(rotated, cv2.COLOR_BGR2GRAY), cv2)

        try:
            text = pytesseract.image_to_string(Image.fromarray(gray), lang="ara+eng", config="--oem 1 --psm 6")
        except Exception:
            text = ""

        score = orientation_score(text) + layout_orientation_score(rotated, Image, pytesseract, cv2)

        if score > best_score:
            best_score = score
            best_image = rotated

    return best_image


def layout_orientation_score(cv_image, Image, pytesseract, cv2):
    score = 0
    regions = [
        (0.73, 0.23, 0.98, 0.33),
        (0.73, 0.31, 0.98, 0.41),
        (0.50, 0.74, 0.98, 0.85),
        (0.30, 0.06, 0.62, 0.18),
    ]

    for region in regions:
        crop = crop_cv_region(cv_image, region)
        rgb_crop = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
        pil_crop = Image.fromarray(rgb_crop)
        resized = pil_crop.resize(
            (max(1, pil_crop.width * 2), max(1, pil_crop.height * 2)),
            Image.Resampling.LANCZOS,
        )

        try:
            text = pytesseract.image_to_string(resized, lang="ara", config="--oem 1 --psm 7")
        except Exception:
            text = ""

        score += min(8, max(0, ocr_text_quality(text) / 20))

    height, width = cv_image.shape[:2]
    if width > height:
        score += 3

    return score


def crop_cv_region(cv_image, region):
    height, width = cv_image.shape[:2]
    left, top, right, bottom = region
    x1 = max(0, min(width - 1, int(width * left)))
    y1 = max(0, min(height - 1, int(height * top)))
    x2 = max(x1 + 1, min(width, int(width * right)))
    y2 = max(y1 + 1, min(height, int(height * bottom)))
    return cv_image[y1:y2, x1:x2]


def ocr_text_quality(text):
    normalized_text = normalize_arabic(text)
    arabic_count = len(ARABIC_CHAR_PATTERN.findall(normalized_text))
    digit_count = len(re.findall(r"\d", normalized_text))
    latin_noise = len(re.findall(r"[A-Za-z]{3,}", normalized_text))
    label_score = orientation_score(normalized_text) * 30
    length_penalty = max(0, len(normalized_text) - 220) * 0.35

    return label_score + arabic_count * 2 + digit_count - latin_noise * 4 - length_penalty


ARABIC_REQUIRED_LAYOUT_FIELDS = {
    "first_name",
    "last_name",
    "father_name",
    "mother_name",
    "place_of_birth",
    "gender",
    "marital_status",
    "registry_place",
    "governorate",
}

NUMERIC_LAYOUT_FIELDS = {"date_of_birth", "national_id_number", "registry_number"}


def is_usable_layout_text(text, field):
    normalized_text = normalize_arabic(text)

    if not normalized_text:
        return False

    if field in ARABIC_REQUIRED_LAYOUT_FIELDS:
        return bool(ARABIC_CHAR_PATTERN.search(normalized_text))

    if field in NUMERIC_LAYOUT_FIELDS:
        return bool(re.search(r"\d", normalized_text))

    if field == "blood_type":
        return bool(re.search(r"(?:A|B|AB|O)\s*[+-]|[+-]\s*(?:A|B|AB|O)", normalized_text, re.IGNORECASE))

    return True


def ocr_cv_region(cv_image, region, Image, pytesseract, cv2, field=None):
    crop = crop_cv_region(cv_image, region)
    rgb_crop = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
    pil_crop = Image.fromarray(rgb_crop)
    scale = 4 if max(pil_crop.size) < 650 else 3
    resized = pil_crop.resize(
        (max(1, pil_crop.width * scale), max(1, pil_crop.height * scale)),
        Image.Resampling.LANCZOS,
    )
    gray = resized.convert("L")
    variants = [resized, gray]
    configs = [
        ("ara", "--oem 1 --psm 7"),
        ("ara", "--oem 1 --psm 6"),
        ("ara", "--oem 1 --psm 11"),
        ("ara", "--oem 1 --psm 13"),
    ]

    if field in {"blood_type", "date_of_birth", "national_id_number", "registry_number"}:
        configs.extend(
            [
                ("ara+eng", "--oem 1 --psm 7"),
                ("ara+eng", "--oem 1 --psm 6"),
            ]
        )

    results = []

    for variant in variants:
        for lang, config in configs:
            try:
                text = pytesseract.image_to_string(variant, lang=lang, config=config)
                if text.strip() and is_usable_layout_text(text, field):
                    results.append(text)
            except Exception:
                pass

    return max(results, key=ocr_text_quality, default="")


def crop_to_base64_png(cv_image, region, cv2):
    crop = crop_cv_region(cv_image, region)
    ok, encoded = cv2.imencode(".png", crop)

    if not ok:
        return ""

    return base64.b64encode(encoded.tobytes()).decode("ascii")


def crop_signature_to_base64_png(cv_image, cv2, numpy):
    return crop_to_base64_png(cv_image, FRONT_ASSET_REGIONS["signature"], cv2)


def extract_labeled_value(text, patterns):
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            return re.sub(r"\s+", " ", match.group(1)).strip(" :.-")

    return ""


def extract_arabic_labeled_value(text, labels, value_pattern=r"([^\r\n:]{1,80})"):
    normalized_text = normalize_arabic(text, collapse_spaces=False)

    for label in sorted(labels, key=len, reverse=True):
        normalized_label = normalize_arabic(label)
        patterns = [
            rf"{re.escape(normalized_label)}\s*[:\-]?\s*{value_pattern}",
            rf"{value_pattern}\s*[:\-]?\s*{re.escape(normalized_label)}",
        ]

        for pattern in patterns:
            match = re.search(pattern, normalized_text, re.IGNORECASE | re.MULTILINE)
            if match:
                return re.sub(r"\s+", " ", match.group(1)).strip(" :.-")

    return ""


def strip_known_arabic_labels(value):
    labels = [
        "الاسم والشهره",
        "الاسم والشهرة",
        "الاسم",
        "الشهره",
        "الشهرة",
        "اسم العائله",
        "اسم العائلة",
        "اسم الاب",
        "اسم الأب",
        "الاب",
        "الأب",
        "اسم الام",
        "اسم الأم",
        "الام",
        "الأم",
        "تاريخ الولاده",
        "تاريخ الولادة",
        "تاريخ الميلاد",
        "رقم الهويه",
        "رقم الهوية",
        "الرقم الوطني",
        "محل الولاده",
        "محل الولادة",
        "مكان الولاده",
        "مكان الولادة",
        "فئه الدم",
        "فئة الدم",
        "الوضع العائلي",
        "الوضع العايلي",
        "رقم السجل",
        "المخلة او القرية",
        "المحلة او القرية",
        "المحافظه",
        "المحافظة",
        "القضاء",
        "الجنس",
        "المحافظه",
        "المحافظة",
    ]
    cleaned = normalize_arabic(value)

    for label in labels:
        cleaned = cleaned.replace(normalize_arabic(label), " ")

    return re.sub(r"\s+", " ", cleaned).strip(" :.-")


def extract_arabic_full_name(text):
    return extract_arabic_labeled_value(
        text,
        ["الاسم والشهرة", "الاسم والشهره", "الاسم الكامل", "الاسم الثلاثي"],
        r"([^\r\n:]{2,100})",
    )


def split_arabic_full_name(full_name):
    parts = [part for part in strip_known_arabic_labels(full_name).split(" ") if part]

    if len(parts) >= 2:
        return parts[0], parts[-1]

    if len(parts) == 1:
        return parts[0], ""

    return "", ""


def clean_person_name_value(value):
    cleaned = strip_known_arabic_labels(value)

    if ARABIC_CHAR_PATTERN.search(cleaned):
        cleaned = re.sub(r"[^\u0600-\u06ff\s]", " ", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
    elif re.search(r"[A-Za-z]", cleaned):
        return ""

    return cleaned


def clean_place_value(value):
    cleaned = strip_known_arabic_labels(value)

    if ARABIC_CHAR_PATTERN.search(cleaned):
        cleaned = re.sub(r"[^\u0600-\u06ff\s]", " ", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
    elif re.search(r"[A-Za-z]", cleaned):
        return ""

    return cleaned


def is_low_confidence_extraction(field, extracted_value):
    normalized_value = normalize_arabic(extracted_value)

    if not normalized_value:
        return True

    if field.endswith("name"):
        return not ARABIC_CHAR_PATTERN.search(normalized_value) or len(normalize_name(extracted_value)) < 4

    if field == "place_of_birth":
        translated_value = translate_arabic_value(extracted_value, "governorate")
        return not translated_value and not ARABIC_CHAR_PATTERN.search(normalized_value)

    if field == "marital_status":
        return not translate_arabic_value(extracted_value, "marital_status")

    if field == "date_of_birth":
        return not parse_date(extracted_value)

    if field == "national_id_number":
        return len(normalize_id(extracted_value)) < 8

    if field == "registry_number":
        return not normalize_id(extracted_value)

    if field == "blood_type":
        return not re.fullmatch(r"(?:A|B|AB|O)[+-]", normalize(extracted_value).upper().replace(" ", ""))

    if field in {"gender", "governorate"}:
        return extracted_value not in {
            "male",
            "female",
            "beirut",
            "mount_lebanon",
            "north_lebanon",
            "akkar",
            "beqaa",
            "baalbek_hermel",
            "south_lebanon",
            "nabatieh",
        }

    return False


def extract_first_matching(pattern, text):
    match = re.search(pattern, normalize_arabic(text), re.IGNORECASE | re.MULTILINE)
    return match.group(1) if match else ""


def parse_json_object_from_text(text):
    raw = str(text or "").strip()
    raw = re.sub(r"^```(?:json)?", "", raw, flags=re.IGNORECASE).strip()
    raw = re.sub(r"```$", "", raw).strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(raw[start : end + 1])
        except json.JSONDecodeError:
            return None

    return None


def gemini_inline_part(file_record, mime_type):
    return {
        "inline_data": {
            "mime_type": mime_type,
            "data": file_record.get("content_base64", ""),
        }
    }


def gemini_model_candidates(primary_env_name):
    configured = os.environ.get(primary_env_name, "").strip()
    candidates = [
        configured,
        os.environ.get("GEMINI_MODEL", "").strip(),
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
    ]
    unique_candidates = []

    for candidate in candidates:
        if candidate and candidate not in unique_candidates:
            unique_candidates.append(candidate)

    return unique_candidates


def gemini_api_keys():
    candidates = [
        os.environ.get("GEMINI_API_KEY", "").strip(),
        os.environ.get("GEMINI_API_KEY_2", "").strip(),
        os.environ.get("GEMINI_API_KEY_3", "").strip(),
        os.environ.get("GEMINI_API_KEY_4", "").strip(),
    ]
    candidates.extend(
        key.strip()
        for key in os.environ.get("GEMINI_API_KEYS", "").split(",")
        if key.strip()
    )
    unique_candidates = []

    for candidate in candidates:
        if candidate and candidate not in unique_candidates:
            unique_candidates.append(candidate)

    return unique_candidates


def call_gemini_generate(model, api_key, parts):
    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        + urllib.parse.quote(model, safe="")
        + ":generateContent?key="
        + urllib.parse.quote(api_key, safe="")
    )
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": parts,
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "response_mime_type": "application/json",
        },
    }
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=45) as response:
        response_body = response.read().decode("utf-8")

    parsed_response = json.loads(response_body)
    response_parts = parsed_response.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    response_text = "\n".join(part.get("text", "") for part in response_parts)
    return parse_json_object_from_text(response_text)


def call_gemini_ocr(front_file, back_file):
    api_keys = gemini_api_keys()
    if not api_keys:
        return None, "Gemini OCR is not configured."

    prompt = """
You are extracting data from Lebanese national ID images. The ID text is Arabic.
Read the FRONT and BACK images carefully and return only valid JSON.
Do not use applicant-provided data. Use only text visible in the uploaded ID.
If a field is unreadable, return an empty string.

Return this exact shape:
{
  "fields": {
    "first_name": {"raw_arabic": "", "english": ""},
    "last_name": {"raw_arabic": "", "english": ""},
    "father_name": {"raw_arabic": "", "english": ""},
    "mother_name": {"raw_arabic": "", "english": ""},
    "date_of_birth": {"raw_arabic": "", "english": ""},
    "place_of_birth": {"raw_arabic": "", "english": ""},
    "national_id_number": {"raw_arabic": "", "english": ""},
    "gender": {"raw_arabic": "", "english": ""},
    "governorate": {"raw_arabic": "", "english": ""},
    "blood_type": {"raw_arabic": "", "english": ""},
    "marital_status": {"raw_arabic": "", "english": ""},
    "registry_number": {"raw_arabic": "", "english": ""}
  },
  "notes": ""
}

Translate Arabic names to common English spelling. Normalize gender to Male/Female,
marital_status to Single/Married/Divorced/Widowed, governorate/place to English,
dates to YYYY-MM-DD when possible, and keep ID/registry numbers as digits.
""".strip()
    parts = [
        {"text": prompt + "\n\nFRONT IMAGE:"},
        gemini_inline_part(front_file, "image/jpeg"),
        {"text": "BACK IMAGE:"},
        gemini_inline_part(back_file, "image/jpeg"),
    ]
    errors = []

    for key_index, api_key in enumerate(api_keys, start=1):
        for model in gemini_model_candidates("GEMINI_OCR_MODEL"):
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

    return None, "Gemini OCR request failed. " + " | ".join(errors[:3])


def call_gemini_text_agent(prompt, input_payload):
    api_keys = gemini_api_keys()
    if not api_keys:
        return None, "Gemini verification agent is not configured."

    parts = [
        {
            "text": prompt
            + "\n\nINPUT JSON:\n"
            + json.dumps(input_payload, ensure_ascii=False, default=str),
        }
    ]
    errors = []

    for key_index, api_key in enumerate(api_keys, start=1):
        for model in gemini_model_candidates("GEMINI_AGENT_MODEL"):
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

    return None, "Gemini verification agent failed. " + " | ".join(errors[:3])


def normalize_gemini_extracted(gemini_result):
    fields = gemini_result.get("fields") or {}
    extracted = {field: "" for field in TEXT_FIELDS}
    raw_arabic = {}

    for field in TEXT_FIELDS:
        value = fields.get(field) or {}
        if isinstance(value, str):
            english_value = value
            raw_value = ""
        else:
            english_value = value.get("english", "")
            raw_value = value.get("raw_arabic", "")

        if raw_value and ARABIC_CHAR_PATTERN.search(str(raw_value)):
            raw_arabic[field] = normalize_arabic(raw_value)

        if field in {"first_name", "last_name", "father_name", "mother_name", "place_of_birth"}:
            extracted[field] = normalize(english_value).title()
        elif field == "date_of_birth":
            extracted[field] = parse_date(english_value) or parse_date(raw_value)
        elif field in {"national_id_number", "registry_number"}:
            extracted[field] = normalize_id(english_value or raw_value)
        elif field == "gender":
            extracted[field] = translate_arabic_value(raw_value, "gender") or normalize(english_value)
        elif field == "governorate":
            extracted[field] = (
                translate_arabic_value(raw_value, "governorate")
                or normalize_enum_value(english_value)
            )
        elif field == "marital_status":
            extracted[field] = translate_arabic_value(raw_value, "marital_status") or normalize(english_value)
        elif field == "blood_type":
            blood_type = normalize(english_value or raw_value).upper().replace(" ", "")
            if blood_type.startswith(("+", "-")) and len(blood_type) > 1:
                blood_type = blood_type[1:] + blood_type[0]
            extracted[field] = blood_type

    if raw_arabic:
        extracted["_raw_arabic"] = raw_arabic
    extracted["_ocr_provider"] = "gemini"
    extracted["_ocr_model"] = gemini_result.get("_model", "")
    extracted["_translation_method"] = "gemini_vision_arabic_to_english"

    return extracted


def extract_identity_fields_with_gemini(front_file, back_file):
    gemini_result, error = call_gemini_ocr(front_file, back_file)
    if error or not gemini_result:
        return None, error

    return normalize_gemini_extracted(gemini_result), ""


def normalize_agent_value(field, value):
    if value is None:
        return ""

    if field in {"first_name", "last_name", "father_name", "mother_name", "place_of_birth"}:
        return normalize(value).title()

    if field == "date_of_birth":
        return parse_date(value)

    if field in {"national_id_number", "registry_number"}:
        return normalize_id(value)

    if field == "gender":
        translated = translate_arabic_value(value, "gender")
        normalized = normalize_enum_value(value)
        if normalized in {"male", "female"}:
            return normalized
        return translated or normalized

    if field == "governorate":
        return translate_arabic_value(value, "governorate") or normalize_enum_value(value)

    if field == "marital_status":
        return translate_arabic_value(value, "marital_status") or normalize_enum_value(value)

    if field == "blood_type":
        blood_type = normalize(value).upper().replace(" ", "")
        if blood_type.startswith(("+", "-")) and len(blood_type) > 1:
            blood_type = blood_type[1:] + blood_type[0]
        return blood_type

    return normalize(value)


def normalize_verification_agent_result(agent_result, existing_extracted):
    fields = agent_result.get("fields") or agent_result.get("extracted") or {}
    extracted = dict(existing_extracted)
    raw_arabic = dict(existing_extracted.get("_raw_arabic") or {})

    for field in TEXT_FIELDS:
        value = fields.get(field)
        raw_value = ""

        if isinstance(value, dict):
            raw_value = value.get("raw_arabic", "")
            value = value.get("english", "") or value.get("value", "")

        normalized_value = normalize_agent_value(field, value)

        if normalized_value:
            extracted[field] = normalized_value

        if raw_value and ARABIC_CHAR_PATTERN.search(str(raw_value)):
            raw_arabic[field] = normalize_arabic(raw_value)

    if raw_arabic:
        extracted["_raw_arabic"] = raw_arabic

    extracted["_verification_agent"] = "gemini"
    extracted["_verification_agent_model"] = agent_result.get("_model", "")
    extracted["_translation_method"] = "python_ocr_then_gemini_verification_agent"
    extracted["_agent_notes"] = normalize(agent_result.get("notes", ""))

    return extracted


def reconcile_extracted_with_user_hints(user, extracted):
    reconciled = dict(extracted)
    corrected_fields = list(reconciled.get("_agent_corrected_fields") or [])

    provided_national_id = normalize_id(user.get("national_id_number"))
    extracted_national_id = normalize_id(reconciled.get("national_id_number"))
    national_id_digit_delta = edit_distance(provided_national_id, extracted_national_id, 2)

    if (
        provided_national_id
        and extracted_national_id
        and len(provided_national_id) == len(extracted_national_id)
        and provided_national_id != extracted_national_id
        and (
            national_id_digit_delta <= 2
            or sorted(provided_national_id) == sorted(extracted_national_id)
        )
    ):
        reconciled["national_id_number"] = provided_national_id
        corrected_fields.append("national_id_number")

    if corrected_fields:
        reconciled["_agent_corrected_fields"] = sorted(set(corrected_fields))

    return reconciled


def run_verification_agent(user, extracted, front_text, back_text, layout_texts):
    prompt = """
You are a verification agent for account verification using Lebanese national ID OCR.
The Python OCR has already extracted raw text, field-region text, and initial fields.
Your job is to return corrected normalized JSON for comparison.

Rules:
- Use the OCR text, layout text, and extracted fields as the evidence.
- Use applicant-provided fields only as candidate spellings for transliteration or obvious OCR mistakes.
- Do not invent a different person. If the ID evidence clearly belongs to another person, keep the ID values and set warnings.
- Correct common Arabic OCR/transliteration errors, including missing Latin letters in names.
- If an ID number, date, gender, marital status, or registry number is visible in OCR/layout, normalize it.
- If a field is not visible in the evidence, return an empty string for that field.
- Return only valid JSON.

Return this exact shape:
{
  "fields": {
    "first_name": "",
    "last_name": "",
    "father_name": "",
    "mother_name": "",
    "date_of_birth": "",
    "place_of_birth": "",
    "national_id_number": "",
    "gender": "",
    "governorate": "",
    "blood_type": "",
    "marital_status": "",
    "registry_number": ""
  },
  "warnings": [],
  "notes": ""
}

Normalize dates to YYYY-MM-DD, gender to male/female, marital_status to
single/married/divorced/widowed, governorate to snake_case, and numbers to digits.
""".strip()

    agent_result, agent_error = call_gemini_text_agent(
        prompt,
        {
            "applicant_provided": {field: user.get(field, "") for field in TEXT_FIELDS},
            "python_extracted": {field: extracted.get(field, "") for field in TEXT_FIELDS},
            "raw_arabic": extracted.get("_raw_arabic", {}),
            "ocr_text": {
                "front": front_text[:3000],
                "back": back_text[:3000],
                "layout": {field: value[:500] for field, value in (layout_texts or {}).items()},
            },
        },
    )

    if agent_error or not agent_result:
        return extracted, agent_error

    return normalize_verification_agent_result(agent_result, extracted), ""


FRONT_FIELD_REGIONS = {
    "first_name": (0.73, 0.23, 0.98, 0.33),
    "last_name": (0.73, 0.31, 0.98, 0.41),
    "father_name": (0.68, 0.38, 0.98, 0.48),
    "mother_name": (0.58, 0.47, 0.98, 0.58),
    "place_of_birth": (0.58, 0.66, 0.98, 0.78),
    "date_of_birth": (0.50, 0.74, 0.98, 0.85),
    "national_id_number": (0.35, 0.84, 0.95, 0.98),
}

BACK_FIELD_REGIONS = {
    "blood_type": (0.30, 0.06, 0.62, 0.18),
    "gender": (0.78, 0.00, 1.00, 0.10),
    "marital_status": (0.70, 0.08, 1.00, 0.21),
    "registry_number": (0.70, 0.27, 1.00, 0.37),
    "registry_place": (0.55, 0.25, 1.00, 0.46),
    "governorate": (0.50, 0.25, 1.00, 0.70),
}

FRONT_ASSET_REGIONS = {
    "id_face": (0.08, 0.31, 0.36, 0.80),
    "signature": (0.075, 0.875, 0.365, 0.985),
}


def extract_layout_texts(front_file, back_file, Image, pytesseract, cv2, numpy):
    front_image = best_oriented_cv_image(front_file, Image, pytesseract, cv2, numpy)
    back_image = best_oriented_cv_image(back_file, Image, pytesseract, cv2, numpy)
    layout = {}
    assets = {}

    if front_image is not None:
        for field, region in FRONT_FIELD_REGIONS.items():
            layout[field] = ocr_cv_region(front_image, region, Image, pytesseract, cv2, field)

        assets["id_face"] = crop_to_base64_png(front_image, FRONT_ASSET_REGIONS["id_face"], cv2)
        assets["signature"] = crop_signature_to_base64_png(front_image, cv2, numpy)

    if back_image is not None:
        for field, region in BACK_FIELD_REGIONS.items():
            layout[field] = ocr_cv_region(back_image, region, Image, pytesseract, cv2, field)

    return layout, assets


def extract_identity_fields(front_text, back_text, layout_texts=None, user=None):
    layout_texts = layout_texts or {}
    user = user or {}
    all_text = f"{front_text}\n{back_text}"
    arabic_full_name = extract_arabic_full_name(all_text)
    fallback_first_name, fallback_last_name = split_arabic_full_name(arabic_full_name)

    extracted = {
        "first_name": extract_labeled_value(
            f"{layout_texts.get('first_name', '')}\n{all_text}",
            [
                r"(?:first\s*name|given\s*name|prenom|pr[ée]nom)\s*[:\-]?\s*([A-Za-z][A-Za-z\s'-]{1,60})",
                r"(?:name|nom)\s*[:\-]?\s*([A-Za-z][A-Za-z\s'-]{1,60})",
            ],
        )
        or extract_arabic_labeled_value(
            f"{layout_texts.get('first_name', '')}\n{all_text}",
            ["الاسم", "الإسم", "الاسم الشخصي", "الاسم الاول", "الإسم الأول"],
        )
        or fallback_first_name,
        "last_name": extract_labeled_value(
            f"{layout_texts.get('last_name', '')}\n{all_text}",
            [
                r"(?:last\s*name|surname|family\s*name|nom\s*de\s*famille)\s*[:\-]?\s*([A-Za-z][A-Za-z\s'-]{1,60})",
            ],
        )
        or extract_arabic_labeled_value(
            f"{layout_texts.get('last_name', '')}\n{all_text}",
            ["الشهرة", "الشهره", "اسم العائلة", "اسم العائله", "الكنية"],
        )
        or fallback_last_name,
        "father_name": extract_labeled_value(
            f"{layout_texts.get('father_name', '')}\n{all_text}",
            [
                r"(?:father|father\s*name|p[èe]re)\s*[:\-]?\s*([A-Za-z][A-Za-z\s'-]{1,60})",
            ],
        )
        or extract_arabic_labeled_value(
            f"{layout_texts.get('father_name', '')}\n{all_text}",
            ["اسم الاب", "اسم الأب", "الأب", "الاب"],
        ),
        "mother_name": extract_labeled_value(
            f"{layout_texts.get('mother_name', '')}\n{all_text}",
            [
                r"(?:mother|mother\s*name|m[èe]re)\s*[:\-]?\s*([A-Za-z][A-Za-z\s'-]{1,60})",
            ],
        )
        or extract_arabic_labeled_value(
            f"{layout_texts.get('mother_name', '')}\n{all_text}",
            ["اسم الام وشهرتها", "اسم الأم وشهرتها", "اسم الام وشهرقا", "اسم الأم وشهرقا", "اسم الام", "اسم الأم", "الأم", "الام"],
        ),
        "date_of_birth": extract_labeled_value(
            f"{layout_texts.get('date_of_birth', '')}\n{all_text}",
            [
                r"(?:date\s*of\s*birth|birth\s*date|dob|n[ée]\s*le)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})",
                r"(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})",
            ],
        )
        or extract_arabic_labeled_value(
            all_text,
            ["تاريخ الولادة", "مواليد", "تاريخ الميلاد"],
            r"(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})",
        )
        or extract_first_matching(
            r"(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})",
            all_text,
        ),
        "national_id_number": extract_labeled_value(
            f"{layout_texts.get('national_id_number', '')}\n{all_text}",
            [
                r"(?:national\s*id|id\s*number|identity\s*number|no\.?)\s*[:\-]?\s*([0-9][0-9\s\-]{4,30})",
            ],
        )
        or extract_arabic_labeled_value(
            all_text,
            ["رقم السجل", "رقم الهوية", "رقم الهويه", "الرقم الوطني", "رقم"],
            r"([0-9٠-٩][0-9٠-٩\s\-]{4,30})",
        )
        or extract_first_matching(r"([0-9]{8,20})", all_text),
        "gender": extract_labeled_value(
            f"{layout_texts.get('gender', '')}\n{all_text}",
            [
                r"(?:gender|sex|sexe)\s*[:\-]?\s*(male|female|m|f|homme|femme)",
            ],
        )
        or extract_arabic_labeled_value(all_text, ["الجنس", "النوع"], r"([\u0600-\u06ff]{2,12})"),
        "governorate": extract_labeled_value(
            f"{layout_texts.get('governorate', '')}\n{all_text}",
            [
                r"(?:governorate|governate|mohafaza|province)\s*[:\-]?\s*([A-Za-z][A-Za-z\s'-]{1,60})",
            ],
        )
        or extract_arabic_labeled_value(all_text, ["المحافظة", "محافظة"], r"([^\r\n:]{2,40})"),
        "place_of_birth": extract_arabic_labeled_value(
            f"{layout_texts.get('place_of_birth', '')}\n{all_text}",
            ["محل الولادة", "مكان الولادة", "محل الولاده", "مكان الولاده", "محل الؤالادة", "محل الولاده"],
            r"([^\r\n:]{2,60})",
        )
        or next(
            (
                english_value
                for arabic_value, english_value in ARABIC_GOVERNORATE_MAP.items()
                if normalize_arabic(arabic_value) in normalize_arabic(all_text)
            ),
            "",
        ),
        "blood_type": extract_labeled_value(
            f"{layout_texts.get('blood_type', '')}\n{all_text}",
            [
                r"(?:blood\s*type|blood)\s*[:\-]?\s*((?:A|B|AB|O)\s*[+-])",
                r"(?:فئه|فئة)?\s*الدم\s*[:\-]?\s*([+-]\s*(?:A|B|AB|O)|(?:A|B|AB|O)\s*[+-])",
            ],
        )
        or extract_first_matching(
            r"([+-]\s*(?:A|B|AB|O)|(?:A|B|AB|O)\s*[+-])",
            f"{layout_texts.get('blood_type', '')}\n{all_text}",
        ),
        "marital_status": extract_arabic_labeled_value(
            f"{layout_texts.get('marital_status', '')}\n{all_text}",
            ["الوضع العائلي", "الوضع العايلي", "الوضع العائلى", "الحالة الاجتماعية"],
            r"([^\r\n:]{2,40})",
        ),
        "registry_number": extract_arabic_labeled_value(
            f"{layout_texts.get('registry_number', '')}\n{all_text}",
            ["رقم السجل", "رقم سجل"],
            r"([0-9٠-٩][0-9٠-٩\s\-]{1,20})",
        )
        or extract_first_matching(r"([0-9٠-٩]{2,12})", layout_texts.get("registry_number", "")),
    }

    if extracted["gender"].lower() in {"m", "homme"}:
        extracted["gender"] = "male"
    elif extracted["gender"].lower() in {"f", "femme"}:
        extracted["gender"] = "female"
    else:
        extracted["gender"] = translate_arabic_value(extracted["gender"], "gender")

    if not extracted["gender"]:
        extracted["gender"] = translate_arabic_value(all_text, "gender")

    extracted["governorate"] = translate_arabic_value(extracted["governorate"], "governorate")

    if not extracted["governorate"]:
        extracted["governorate"] = translate_arabic_value(all_text, "governorate")

    if not extracted["governorate"]:
        extracted["governorate"] = translate_arabic_value(layout_texts.get("governorate", ""), "governorate")

    if not extracted["gender"]:
        extracted["gender"] = translate_arabic_value(layout_texts.get("gender", ""), "gender")

    if normalize_arabic(extracted["first_name"]).startswith("والشهر") and fallback_first_name:
        extracted["first_name"] = fallback_first_name

    if arabic_full_name and normalize_arabic(extracted["last_name"]) == normalize_arabic(arabic_full_name):
        extracted["last_name"] = fallback_last_name

    for field in ("first_name", "last_name", "father_name", "mother_name"):
        extracted[field] = clean_person_name_value(extracted[field])

    extracted["place_of_birth"] = clean_place_value(extracted["place_of_birth"])
    extracted["date_of_birth"] = parse_date(extracted["date_of_birth"])
    extracted["national_id_number"] = normalize_id(extracted["national_id_number"])
    extracted["registry_number"] = normalize_id(extracted["registry_number"])
    blood_type = normalize(extracted["blood_type"]).upper().replace(" ", "")
    if blood_type.startswith(("+", "-")) and len(blood_type) > 1:
        blood_type = blood_type[1:] + blood_type[0]
    extracted["blood_type"] = blood_type
    extracted["marital_status"] = translate_arabic_value(extracted["marital_status"], "marital_status") or normalize(
        extracted["marital_status"]
    )

    for field in TEXT_FIELDS:
        if is_low_confidence_extraction(field, extracted.get(field, "")):
            extracted[field] = ""

    return extracted


def pil_to_cv_image(image, cv2, numpy):
    return cv2.cvtColor(numpy.array(image), cv2.COLOR_RGB2BGR)


def extract_face_crop(file_record, Image, cv2, numpy, *, strict=False):
    image = image_from_file(file_record, Image)

    if image is None:
        return None

    cv_image = pil_to_cv_image(image, cv2, numpy)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")
    best_face = None
    best_score = 0

    for angle in (0, 90, 180, 270):
        rotated = cv_image if angle == 0 else rotate_cv_image(cv_image, angle, cv2)
        gray = cv2.cvtColor(rotated, cv2.COLOR_BGR2GRAY)
        gray = normalize_image_size(gray, cv2)
        equalized = cv2.equalizeHist(gray)
        image_height, image_width = equalized.shape[:2]
        min_face_size = max(48, min(image_width, image_height) // 9)
        faces = face_cascade.detectMultiScale(
            equalized,
            scaleFactor=1.05,
            minNeighbors=6 if strict else 4,
            minSize=(min_face_size, min_face_size),
        )

        for x, y, width, height in faces:
            area = width * height
            image_area = image_width * image_height

            if area < image_area * 0.008 or area > image_area * 0.72:
                continue

            face_region = equalized[y : y + height, x : x + width]
            upper_face = face_region[: max(1, int(height * 0.62)), :]
            min_eye_width = max(10, width // 12)
            min_eye_height = max(8, height // 18)
            eyes = eye_cascade.detectMultiScale(
                upper_face,
                scaleFactor=1.08,
                minNeighbors=4,
                minSize=(min_eye_width, min_eye_height),
            )

            valid_eyes = []
            for eye_x, eye_y, eye_width, eye_height in eyes:
                center_y_ratio = (eye_y + eye_height / 2) / max(1, height)
                if 0.12 <= center_y_ratio <= 0.58:
                    valid_eyes.append((eye_x, eye_y, eye_width, eye_height))

            # The selfie is user-controlled input, so require visible facial structure.
            # This prevents a document, graphic, or random image from receiving a high score.
            if strict and len(valid_eyes) < 1:
                continue

            quality_score = area * (1 + min(len(valid_eyes), 2) * 0.35)

            if quality_score > best_score:
                best_score = quality_score
                best_face = equalized[y : y + height, x : x + width]

    if best_face is None:
        return None

    return cv2.resize(best_face, (160, 160))


def lbp_histogram(gray_face, cv2, numpy):
    resized = cv2.resize(gray_face, (96, 96))
    center = resized[1:-1, 1:-1]
    lbp = numpy.zeros_like(center, dtype=numpy.uint8)
    neighbors = [
        resized[:-2, :-2],
        resized[:-2, 1:-1],
        resized[:-2, 2:],
        resized[1:-1, 2:],
        resized[2:, 2:],
        resized[2:, 1:-1],
        resized[2:, :-2],
        resized[1:-1, :-2],
    ]

    for bit_index, neighbor in enumerate(neighbors):
        lbp |= ((neighbor >= center).astype(numpy.uint8) << bit_index)

    histogram = cv2.calcHist([lbp], [0], None, [64], [0, 256])
    cv2.normalize(histogram, histogram)
    return histogram


def orb_face_score(front_face, selfie_face, cv2):
    orb = cv2.ORB_create(nfeatures=350, fastThreshold=8)
    front_keypoints, front_descriptors = orb.detectAndCompute(front_face, None)
    selfie_keypoints, selfie_descriptors = orb.detectAndCompute(selfie_face, None)

    if (
        front_descriptors is None
        or selfie_descriptors is None
        or len(front_keypoints) < 8
        or len(selfie_keypoints) < 8
    ):
        return 0.0

    matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = sorted(matcher.match(front_descriptors, selfie_descriptors), key=lambda match: match.distance)
    good_matches = [match for match in matches if match.distance <= 58]
    possible_matches = max(1, min(len(front_keypoints), len(selfie_keypoints)))

    return max(0.0, min(1.0, len(good_matches) / possible_matches))


def face_similarity_score(front_face, selfie_face, cv2, numpy):
    front_equalized = cv2.equalizeHist(front_face)
    selfie_equalized = cv2.equalizeHist(selfie_face)

    diff = cv2.absdiff(front_equalized, selfie_equalized)
    mse = float(numpy.mean(diff ** 2))
    mse_score = max(0.0, min(1.0, 1.0 - (mse / 8500.0)))

    front_hist = cv2.calcHist([front_equalized], [0], None, [64], [0, 256])
    selfie_hist = cv2.calcHist([selfie_equalized], [0], None, [64], [0, 256])
    cv2.normalize(front_hist, front_hist)
    cv2.normalize(selfie_hist, selfie_hist)
    hist_correlation = float(cv2.compareHist(front_hist, selfie_hist, cv2.HISTCMP_CORREL))
    hist_score = max(0.0, min(1.0, (hist_correlation + 1.0) / 2.0))

    front_lbp = lbp_histogram(front_equalized, cv2, numpy)
    selfie_lbp = lbp_histogram(selfie_equalized, cv2, numpy)
    lbp_correlation = float(cv2.compareHist(front_lbp, selfie_lbp, cv2.HISTCMP_CORREL))
    lbp_score = max(0.0, min(1.0, (lbp_correlation + 1.0) / 2.0))
    orb_score = orb_face_score(front_equalized, selfie_equalized, cv2)

    combined_score = (
        (mse_score * 0.22)
        + (hist_score * 0.18)
        + (lbp_score * 0.35)
        + (orb_score * 0.25)
    )

    if orb_score < 0.04 and lbp_score < 0.72:
        combined_score = min(combined_score, 0.48)
    elif orb_score < 0.08:
        combined_score = min(combined_score, 0.68)

    return max(0.0, min(1.0, combined_score))


def compare_faces(front_file, selfie_file, Image, cv2, numpy):
    front_image = image_from_file(front_file, Image)
    selfie_image = image_from_file(selfie_file, Image)

    if front_image is None or selfie_image is None:
        return 0.0, "The ID front image or selfie image could not be opened."

    front_face = extract_face_crop(front_file, Image, cv2, numpy)
    selfie_face = extract_face_crop(selfie_file, Image, cv2, numpy, strict=True)

    if front_face is None:
        return 0.0, "No valid face was detected on the front of the national ID."

    if selfie_face is None:
        return 0.0, "No valid face was detected in the selfie image."

    return face_similarity_score(front_face, selfie_face, cv2, numpy), ""


def add_raw_bytes(files):
    for item in files:
        if item.get("content_base64"):
            item["raw_bytes"] = base64.b64decode(item["content_base64"])
    return files


def analyze_account(payload):
    Image, pytesseract, cv2, numpy, missing_dependencies = load_optional_dependencies()
    user = payload.get("user") or {}
    files = add_raw_bytes(payload.get("files") or [])
    failures = []
    warnings = []

    front_file = file_by_type(files, "national_id_front")
    back_file = file_by_type(files, "national_id_back")
    selfie_file = file_by_type(files, "selfie_photo")

    for required_type, file_record in [
        ("national_id_front", front_file),
        ("national_id_back", back_file),
        ("selfie_photo", selfie_file),
    ]:
        if not file_record:
            warnings.append(f"Missing {required_type.replace('_', ' ')} upload.")

    extracted = {field: "" for field in TEXT_FIELDS}
    extracted_assets = {}
    front_text = ""
    back_text = ""
    face_score = None

    if missing_dependencies:
        warnings.append(
            "Python AI dependencies are not installed: "
            + ", ".join(sorted(set(missing_dependencies)))
            + ". Install them before enabling automatic account verification."
        )
    elif not warnings:
        gemini_extracted, gemini_error = extract_identity_fields_with_gemini(front_file, back_file)
        layout_texts, extracted_assets = extract_layout_texts(front_file, back_file, Image, pytesseract, cv2, numpy)

        if gemini_extracted:
            extracted = gemini_extracted
            front_text = "Gemini Vision OCR used for structured extraction."
            back_text = json.dumps(gemini_extracted.get("_raw_arabic", {}), ensure_ascii=False)
        else:
            if gemini_api_keys() and gemini_error:
                warnings.append(f"{gemini_error} Falling back to local Tesseract OCR.")

            front_text = ocr_image(front_file, Image, pytesseract, cv2, numpy)
            back_text = ocr_image(back_file, Image, pytesseract, cv2, numpy)
            extracted = extract_identity_fields(front_text, back_text, layout_texts, user)

        if gemini_api_keys():
            agent_extracted, agent_error = run_verification_agent(
                user,
                extracted,
                front_text,
                back_text,
                layout_texts,
            )
            if agent_error:
                warnings.append(f"{agent_error} Using Python OCR extraction only.")
            else:
                extracted = agent_extracted

        extracted = reconcile_extracted_with_user_hints(user, extracted)

        comparison_optional_fields = {"blood_type", "marital_status", "registry_number"}

        for field in TEXT_FIELDS:
            provided = user.get(field)
            extracted_value = extracted.get(field)
            threshold = 0.86 if field.endswith("name") else 1.0
            similarity = text_similarity(provided, extracted_value, field)

            if not extracted_value:
                warnings.append(
                    f"Could not extract {field.replace('_', ' ')} from the national ID; staff review is required."
                )
            elif not provided and field in comparison_optional_fields:
                warnings.append(
                    f"{field.replace('_', ' ').title()} was extracted from the national ID for staff review."
                )
            elif not provided:
                warnings.append(
                    f"No saved {field.replace('_', ' ')} is available to compare against the national ID."
                )
            elif similarity < threshold:
                message = f"{field.replace('_', ' ').title()} does not match the uploaded national ID."
                warnings.append(f"{message} Staff review is required.")

        face_score, face_error = compare_faces(front_file, selfie_file, Image, cv2, numpy)

        if face_error:
            warnings.append(f"{face_error} Staff review is required.")
        elif face_score < 0.62:
            warnings.append("The selfie face requires staff review against the national ID photo.")

        extracted["face_match_score"] = round(face_score * 100, 1)

    status = "verified" if not failures and not warnings else "under_review"

    score = 100
    score -= len(failures) * 18
    score -= len(warnings) * 8
    score = max(0, min(100, score))

    notes = [
        f"Account AI status: {status}",
        f"Score: {score}/100",
    ]

    if failures:
        notes.append("Failed checks: " + "; ".join(failures))

    if warnings:
        notes.append("Warnings: " + "; ".join(warnings))

    display_extracted = translate_extracted_for_display(user, extracted)

    return {
        "score": score,
        "status": status,
        "failures": failures,
        "warnings": warnings,
        "notes": ". ".join(notes),
        "extracted": display_extracted,
        "raw_extracted": extracted,
        "ocr_text": {
            "front": front_text[:2000],
            "back": back_text[:2000],
            "layout": {field: value[:300] for field, value in layout_texts.items()},
        },
        "extracted_assets": extracted_assets,
    }

def main():
    try:
        request = json.load(sys.stdin)
        mode = request.get("mode")

        if mode != "account":
            raise ValueError("Only account verification is supported by this Python AI module")

        result = analyze_account(request.get("payload") or {})
        print(json.dumps({"ok": True, "result": result}))
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
