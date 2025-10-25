-- Enhanced Rate Limiting Schema with Security
-- Replaces in-memory rate limiting with persistent database storage

CREATE TABLE IF NOT EXISTS rate_limits (
    scope TEXT NOT NULL,           -- 'public','auth','admin'
    user_id BIGINT,                -- nullable for unauthenticated
    ip_hash TEXT NOT NULL,
    route TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    count INT NOT NULL DEFAULT 1,
    PRIMARY KEY (scope, COALESCE(user_id, 0), ip_hash, route, window_start)
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_rate_limits_route_window ON rate_limits(route, window_start);

-- Index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

-- TTL cleanup function (run periodically)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limits 
    WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limits TO ignite_fitness_app;
GRANT EXECUTE ON FUNCTION cleanup_rate_limits() TO ignite_fitness_app;
