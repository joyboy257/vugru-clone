import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function markPhotoVirtualStaged(
  photoId: string,
  stagedStorageKey: string,
  stagedPublicUrl: string
): Promise<void> {
  await pool.query(
    `UPDATE photos 
     SET virtualStaged = true, 
         stagedStorageKey = $2, 
         stagedPublicUrl = $3 
     WHERE id = $1`,
    [photoId, stagedStorageKey, stagedPublicUrl]
  );
}

export async function getPool(): Promise<pg.Pool> {
  return pool;
}
