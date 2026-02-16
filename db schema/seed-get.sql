TRUNCATE tournament_leaderboard, match_events, matches, players, tournament_teams, teams, tournaments CASCADE;

INSERT INTO tournaments (id, name, sport_type, start_date, status) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'IPL 2024', 'CRICKET', '2024-03-22', 'LIVE'),
('a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'T20 World Cup 2024', 'CRICKET', '2024-06-01', 'UPCOMING'),
('a2eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Ranji Trophy 2024', 'CRICKET', '2024-01-15', 'COMPLETED');

INSERT INTO teams (id, name, short_code, logo_url) VALUES
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Chennai Super Kings', 'CSK', 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/CSK/Logos/Roundbig/CSKroundbig.png'),
('b2eebc99-9c0b-4ef8-bb6d-6bb9bd380b23', 'Mumbai Indians', 'MI', 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/MI/Logos/Roundbig/MIroundbig.png'),
('b3eebc99-9c0b-4ef8-bb6d-6bb9bd380b24', 'Royal Challengers Bangalore', 'RCB', 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/RCB/Logos/Roundbig/RCBroundbig.png'),
('b4eebc99-9c0b-4ef8-bb6d-6bb9bd380b25', 'Kolkata Knight Riders', 'KKR', 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/KKR/Logos/Roundbig/KKRroundbig.png');

INSERT INTO tournament_teams (tournament_id, team_id) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380b23'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b3eebc99-9c0b-4ef8-bb6d-6bb9bd380b24'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b4eebc99-9c0b-4ef8-bb6d-6bb9bd380b25');

INSERT INTO players (id, team_id, name, role) VALUES
('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'MS Dhoni', 'BATTER'),
('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c02', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Ravindra Jadeja', 'ALL_ROUNDER'),
('c3eebc99-9c0b-4ef8-bb6d-6bb9bd380c03', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Ruturaj Gaikwad', 'BATTER'),
('c4eebc99-9c0b-4ef8-bb6d-6bb9bd380c04', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Deepak Chahar', 'BOWLER');

INSERT INTO players (id, team_id, name, role) VALUES
('c5eebc99-9c0b-4ef8-bb6d-6bb9bd380c05', 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380b23', 'Rohit Sharma', 'BATTER'),
('c6eebc99-9c0b-4ef8-bb6d-6bb9bd380c06', 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380b23', 'Jasprit Bumrah', 'BOWLER'),
('c7eebc99-9c0b-4ef8-bb6d-6bb9bd380c07', 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380b23', 'Hardik Pandya', 'ALL_ROUNDER'),
('c8eebc99-9c0b-4ef8-bb6d-6bb9bd380c08', 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380b23', 'Ishan Kishan', 'BATTER');

INSERT INTO players (id, team_id, name, role) VALUES
('c9eebc99-9c0b-4ef8-bb6d-6bb9bd380c09', 'b3eebc99-9c0b-4ef8-bb6d-6bb9bd380b24', 'Virat Kohli', 'BATTER'),
('ca1ebc99-9c0b-4ef8-bb6d-6bb9bd380c10', 'b3eebc99-9c0b-4ef8-bb6d-6bb9bd380b24', 'Glenn Maxwell', 'ALL_ROUNDER');

INSERT INTO players (id, team_id, name, role) VALUES
('cb1ebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'b4eebc99-9c0b-4ef8-bb6d-6bb9bd380b25', 'Andre Russell', 'ALL_ROUNDER'),
('cc1ebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'b4eebc99-9c0b-4ef8-bb6d-6bb9bd380b25', 'Sunil Narine', 'ALL_ROUNDER');

INSERT INTO matches (id, tournament_id, team_a_id, team_b_id, start_time, status, score_summary) VALUES
('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01',
 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380b23',
 NOW(),
 'LIVE',
 '{"runs": 145, "wickets": 3, "overs": 15.2, "batting_team": "CSK"}'::jsonb
);

INSERT INTO matches (id, tournament_id, team_a_id, team_b_id, start_time, status, score_summary) VALUES
('d2eebc99-9c0b-4ef8-bb6d-6bb9bd380d02',
 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
 'b3eebc99-9c0b-4ef8-bb6d-6bb9bd380b24',
 'b4eebc99-9c0b-4ef8-bb6d-6bb9bd380b25',
 NOW() - INTERVAL '2 days',
 'COMPLETED',
 '{"team_a_score": {"runs": 185, "wickets": 6, "overs": 20}, "team_b_score": {"runs": 178, "wickets": 8, "overs": 20}, "winner": "RCB"}'::jsonb
);

INSERT INTO matches (id, tournament_id, team_a_id, team_b_id, start_time, status) VALUES
('d3eebc99-9c0b-4ef8-bb6d-6bb9bd380d03',
 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380b23',
 'b3eebc99-9c0b-4ef8-bb6d-6bb9bd380b24',
 NOW() + INTERVAL '3 days',
 'SCHEDULED'
);

INSERT INTO match_events (match_id, event_type, event_data, created_at) VALUES

('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'BALL_BOWLED', '{"runs": 4, "batter_id": "c3eebc99-9c0b-4ef8-bb6d-6bb9bd380c03", "bowler_id": "c6eebc99-9c0b-4ef8-bb6d-6bb9bd380c06"}', NOW() - INTERVAL '90 minutes'),
('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'BALL_BOWLED', '{"runs": 1, "batter_id": "c3eebc99-9c0b-4ef8-bb6d-6bb9bd380c03", "bowler_id": "c6eebc99-9c0b-4ef8-bb6d-6bb9bd380c06"}', NOW() - INTERVAL '89 minutes'),
('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'BALL_BOWLED', '{"runs": 0, "batter_id": "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c01", "bowler_id": "c6eebc99-9c0b-4ef8-bb6d-6bb9bd380c06"}', NOW() - INTERVAL '88 minutes'),
('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'BALL_BOWLED', '{"runs": 6, "batter_id": "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c01", "bowler_id": "c6eebc99-9c0b-4ef8-bb6d-6bb9bd380c06"}', NOW() - INTERVAL '87 minutes'),
('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'WICKET', '{"batter_id": "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c01", "bowler_id": "c6eebc99-9c0b-4ef8-bb6d-6bb9bd380c06", "type": "CAUGHT"}', NOW() - INTERVAL '86 minutes'),
('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'BALL_BOWLED', '{"runs": 2, "batter_id": "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c02", "bowler_id": "c6eebc99-9c0b-4ef8-bb6d-6bb9bd380c06"}', NOW() - INTERVAL '85 minutes');

INSERT INTO tournament_leaderboard (tournament_id, player_id, stats) VALUES

('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c9eebc99-9c0b-4ef8-bb6d-6bb9bd380c09', '{"runs": 542, "matches": 12, "average": 45.16, "strike_rate": 148.5, "fifties": 4, "hundreds": 1}'::jsonb),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380c03', '{"runs": 489, "matches": 11, "average": 48.9, "strike_rate": 142.3, "fifties": 5, "hundreds": 0}'::jsonb),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c5eebc99-9c0b-4ef8-bb6d-6bb9bd380c05', '{"runs": 425, "matches": 10, "average": 42.5, "strike_rate": 138.9, "fifties": 3, "hundreds": 1}'::jsonb),

('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c6eebc99-9c0b-4ef8-bb6d-6bb9bd380c06', '{"wickets": 18, "matches": 10, "economy": 6.8, "average": 18.2, "best": "4/25"}'::jsonb),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c4eebc99-9c0b-4ef8-bb6d-6bb9bd380c04', '{"wickets": 15, "matches": 11, "economy": 7.2, "average": 22.5, "best": "3/28"}'::jsonb),

('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'cb1ebc99-9c0b-4ef8-bb6d-6bb9bd380c11', '{"runs": 312, "wickets": 12, "matches": 11, "strike_rate": 185.2, "economy": 8.5}'::jsonb),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c02', '{"runs": 285, "wickets": 10, "matches": 10, "strike_rate": 145.6, "economy": 7.1}'::jsonb);
