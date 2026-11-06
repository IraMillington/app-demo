-- Demo venues for the PickleCourts phone: invented clubs, cloned from the
-- dev seed's native-booking test venue (courts, weekly hours, prices). The
-- seed's other venues carry real businesses' names, so they are unpublished.
BEGIN;

UPDATE venues SET config = jsonb_set(config, '{is_published}', 'false'::jsonb);

CREATE TEMP TABLE demo_venues (id uuid, name text, slug text, street text, lat float, lng float,
  description text, amenities jsonb, courts int, outdoor int, rate_cents int, peak_cents int);
INSERT INTO demo_venues VALUES
  ('d0000000-0000-4000-8000-000000000001', 'Lanternfield Paddle Club', 'lanternfield-paddle-club', '410 Demo Lane', 35.4890, -97.5300,
   'An invented indoor club for this demo: six cushioned courts, open play in the mornings and leagues at night.',
   '["Climate Controlled", "Professional Lighting", "Pro Shop", "Equipment Rental", "Parking"]', 6, 0, 3600, 4400),
  ('d0000000-0000-4000-8000-000000000002', 'Cottonwood Court House', 'cottonwood-court-house', '88 Sample Street', 35.4660, -97.5170,
   'An invented neighborhood spot for this demo, with four indoor courts and two lit outdoor courts.',
   '["Professional Lighting", "Viewing Area", "Water Station", "Parking"]', 6, 2, 2800, 3400),
  ('d0000000-0000-4000-8000-000000000003', 'North Canal Pickle Hall', 'north-canal-pickle-hall', '1200 Example Avenue', 35.5020, -97.5050,
   'An invented hall for this demo: eight courts under one roof, a lounge and a café.',
   '["Climate Controlled", "Lounge", "Café", "Locker Rooms", "WiFi", "Parking"]', 8, 0, 4200, 5200);

INSERT INTO venues (id, name, slug, region_id, timezone, venue_mode, config)
SELECT d.id, d.name, d.slug, src.region_id, src.timezone, src.venue_mode,
  src.config
    || jsonb_build_object('description', d.description, 'amenities', d.amenities, 'latitude', d.lat, 'longitude', d.lng,
         'email', 'hello@example.com', 'phone', '405-555-0100', 'website', 'https://example.com', 'is_published', true,
         'address', jsonb_build_object('street', d.street, 'city', 'Oklahoma City', 'state', 'OK', 'zip', '73104'))
FROM demo_venues d, venues src WHERE src.slug = 'picklecourts-hq-native-test';

INSERT INTO courts (venue_id, name, sport_type, court_type)
SELECT d.id, 'Court ' || n, 'pickleball', CASE WHEN n > d.courts - d.outdoor THEN 'outdoor' ELSE 'indoor' END
FROM demo_venues d, generate_series(1, 8) n WHERE n <= d.courts;

-- Every demo court gets the test venue's weekly hours, at the venue's price
-- (more after 5 PM).
INSERT INTO availabilities (court_id, day_of_week, start_time, end_time, hourly_rate_cents, is_available)
SELECT c.id, a.day_of_week, a.start_time, a.end_time,
  CASE WHEN a.start_time >= '17:00' THEN d.peak_cents ELSE d.rate_cents END, a.is_available
FROM courts c JOIN demo_venues d ON d.id = c.venue_id
CROSS JOIN (SELECT DISTINCT a.day_of_week, a.start_time, a.end_time, a.is_available
            FROM availabilities a JOIN courts sc ON sc.id = a.court_id JOIN venues sv ON sv.id = sc.venue_id
            WHERE sv.slug = 'picklecourts-hq-native-test') a;

COMMIT;
