-- 1. Insert a Tournament (IPL 2024)
INSERT INTO tournaments (id, name, sport_type) 
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'IPL 2024', 'CRICKET');

-- 2. Insert Teams (CSK and MI)
INSERT INTO teams (id, name, short_code) VALUES 
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Chennai Super Kings', 'CSK'),
('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'Mumbai Indians', 'MI');

-- 3. Link Teams to Tournament
INSERT INTO tournament_teams (tournament_id, team_id) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c33');

-- 4. Insert Players
-- CSK Players
INSERT INTO players (team_id, name, role) VALUES 
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'MS Dhoni', 'BATTER'),
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Ravindra Jadeja', 'ALL_ROUNDER');

-- MI Players
INSERT INTO players (team_id, name, role) VALUES 
('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'Rohit Sharma', 'BATTER'),
('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'Jasprit Bumrah', 'BOWLER');

-- 5. Schedule a Match (CSK vs MI)
-- Use this ID in your Postman collection for testing!
INSERT INTO matches (id, tournament_id, team_a_id, team_b_id, start_time, status) 
VALUES (
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380d44', 
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 
    NOW(), 
    'LIVE'
);
