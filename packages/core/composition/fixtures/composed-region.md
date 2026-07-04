### Configuration

Read configuration through the injected config accessor, never process.env directly
<!-- @nodes: no-direct-process-env -->
> Enforced: cargo-clippy-toml — FF7001 (not expressible), npm-eslint-declarative ✅
> Never (fires): const url = process.env.DATABASE_URL;
> Always (clean): const url = config.get('databaseUrl');
