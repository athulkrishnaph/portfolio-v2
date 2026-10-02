-- Featured skills are highlighted on the home page (like featured projects).
ALTER TABLE skills ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false;
