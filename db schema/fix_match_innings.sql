WITH event_ids AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id ASC) as event_num
  FROM match_events
  WHERE match_id = '607cdab0-309f-49fb-9b9e-4fbff662345b'
)
UPDATE match_events me
SET event_data = event_data || '{"innings": 1}'::jsonb
FROM event_ids ei
WHERE me.id = ei.id
  AND ei.event_num <= 20;

WITH event_ids AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id ASC) as event_num
  FROM match_events
  WHERE match_id = '607cdab0-309f-49fb-9b9e-4fbff662345b'
)
UPDATE match_events me
SET event_data = event_data || '{"innings": 2}'::jsonb
FROM event_ids ei
WHERE me.id = ei.id
  AND ei.event_num > 20;
