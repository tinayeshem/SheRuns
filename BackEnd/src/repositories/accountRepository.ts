import { pool } from "../config/db";

// removes everything linked to this user; reports stay, but anonymous
export async function deleteUserData(userId: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from live_sessions where device_id = $1", [userId]);
    await client.query("delete from report_votes where device_id = $1", [userId]);
    await client.query("update reports set device_id = null where device_id = $1", [userId]);
    await client.query("update sms_log set device_id = null where device_id = $1", [userId]);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}