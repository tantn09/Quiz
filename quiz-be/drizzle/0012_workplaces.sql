CREATE TABLE workplaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  name_key varchar(120) NOT NULL UNIQUE
);
--> statement-breakpoint
INSERT INTO workplaces (name, name_key)
SELECT min(trim(workplace)), lower(regexp_replace(trim(workplace), '\s+', ' ', 'g'))
FROM users
WHERE role = 'teacher' AND char_length(trim(workplace)) BETWEEN 1 AND 120
GROUP BY lower(regexp_replace(trim(workplace), '\s+', ' ', 'g'));
