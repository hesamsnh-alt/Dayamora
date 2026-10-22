CREATE TABLE IF NOT EXISTS dayamora.garment_cutouts (
 product_id INTEGER NOT NULL REFERENCES dayamora.products(id),
 color_id TEXT NOT NULL DEFAULT '',
 image_url TEXT NOT NULL,
 updated_by TEXT NOT NULL REFERENCES dayamora.users(id),
 updated_at BIGINT NOT NULL,
 PRIMARY KEY(product_id,color_id)
);
REVOKE ALL ON TABLE dayamora.garment_cutouts FROM PUBLIC;
