import pool from '../db/pool.js';

export const createAuditLog = async ({
  userId,
  action,
  entityType,
  entityId = null,
  details = {},
  client = null,
}) => {
  const dbClient = client || pool;

  await dbClient.query(
    `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [userId, action, entityType, entityId, details]
  );
};
