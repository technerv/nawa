## NAWA Backend Notes

### Geo Seeding
After adding location fields, you can seed coordinates for existing reports:

```bash
cd /Users/Macbook/Projects/nawa/core
python manage.py seed_locations
```

Use `--dry-run` to preview without saving:

```bash
python manage.py seed_locations --dry-run
```

The command fills known Nairobi locations or random points within Nairobi bounds for reports missing coordinates.

