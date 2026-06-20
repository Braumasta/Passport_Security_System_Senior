CREATE OR REPLACE FUNCTION delete_linked_applicant_after_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.applicant_id IS NOT NULL THEN
    DELETE FROM applicants
    WHERE applicant_id = OLD.applicant_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_delete_linked_applicant_after_user_delete ON users;

CREATE TRIGGER trg_delete_linked_applicant_after_user_delete
AFTER DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION delete_linked_applicant_after_user_delete();
