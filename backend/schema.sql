-- Optional production design for a self-hosted PostgreSQL/PostGIS deployment.
-- The runnable local API uses SQLite (app/db.py); configure a PostgreSQL repository adapter before use.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE farm (
 id uuid PRIMARY KEY,
 name text NOT NULL,
 location geometry(Point,4326) NOT NULL,
 boundary geometry(Polygon,4326),
 radius_m double precision CHECK(radius_m>0),
 area_ha double precision NOT NULL CHECK(area_ha>0),
 profile jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX farm_location_gist ON farm USING gist(location);
CREATE TABLE data_observation (
 id uuid PRIMARY KEY,
 source text NOT NULL,
 property text NOT NULL,
 coverage geometry(Geometry,4326),
 observed_at date,
 fetched_at timestamptz NOT NULL DEFAULT now(),
 value jsonb,
 units text NOT NULL,
 resolution_m double precision,
 source_url text NOT NULL,
 provenance jsonb NOT NULL
);
CREATE INDEX observation_coverage_gist ON data_observation USING gist(coverage);
CREATE TABLE analysis (
 id uuid PRIMARY KEY,
 farm_id uuid REFERENCES farm(id),
 created_at timestamptz DEFAULT now(),
 mode text CHECK(mode IN ('demo','live')) NOT NULL,
 result jsonb NOT NULL
);
