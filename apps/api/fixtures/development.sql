-- Clearly synthetic, unpublished records only. Never apply to production.
INSERT INTO products(slug,name,category,description,published) VALUES
 ('fixture-runner','Fixture Treadmill','treadmill','Synthetic development record; not a real offer.',false),
 ('fixture-cycle','Fixture Indoor Bike','bike','Synthetic development record; not a real offer.',false),
 ('fixture-cross-trainer','Fixture Cross Trainer','cross_trainer','Synthetic development record; not a real offer.',false),
 ('fixture-rower','Fixture Rower','rower','Synthetic development record; not a real offer.',false),
 ('fixture-pilates','Fixture Pilates Mat','pilates','Synthetic development record; not a real offer.',false),
 ('fixture-accessory','Fixture Resistance Band','accessory','Synthetic development record; not a real offer.',false),
 ('fixture-bundle','Fixture Training Bundle','bundle','Synthetic development record; not a real offer.',false)
ON CONFLICT(slug) DO NOTHING;
INSERT INTO product_variants(product_id,sku,model,price_minor,currency,tax_configuration,inventory_on_hand,published)
SELECT id, 'FIX-' || upper(replace(slug,'fixture-','')), 'Development fixture', 0, 'GBP', 'unconfigured', 0, false
FROM products WHERE slug LIKE 'fixture-%' ON CONFLICT(sku) DO NOTHING;
INSERT INTO trainers(display_name,biography,published)
SELECT 'Fixture Trainer','Synthetic development profile.',false
WHERE NOT EXISTS (SELECT 1 FROM trainers WHERE display_name='Fixture Trainer');
INSERT INTO workouts(slug,title,activity,duration_minutes,difficulty,published)
VALUES ('fixture-strength','Fixture Strength Session','strength',20,'beginner',false),('fixture-flow','Fixture Mobility Flow','yoga',15,'beginner',false)
ON CONFLICT(slug) DO NOTHING;
