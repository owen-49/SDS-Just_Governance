# Database Initialization Scripts

This directory contains scripts for initializing the database with learning content.

## 📄 `init_governance_content.py`

Populates the database with **Section 1: What is Governance?** content.

### Content Structure

```
Section 1: What is Governance?
└── Module 1.1 — Governance Foundations
    ├── 1.1.1 Governance as "How Decisions Get Made"
    ├── 1.1.2 Why Governance Matters for Community, Justice and Change
    ├── 1.1.3 Different Cultural Worldviews of Governance
    ├── 1.1.4 Governance in Action — Real-World Examples
    └── Glossary of Key Terms
```

### What It Does

1. **Clears existing governance content** (if any)
2. **Creates database structure**:
   - 1 Board: "Section 1: What is Governance?"
   - 1 Module: "Module 1.1 — Governance Foundations"
   - 5 Topics with full Markdown content
   - Learning resources (links to videos, articles, PDFs)
   - Glossary definitions

3. **Safe to run multiple times** - it clears old content before creating new

### Usage

#### Method 1: Using the shell script (Recommended)

```bash
cd backend
chmod +x scripts/init_db.sh
./scripts/init_db.sh
```

#### Method 2: Direct Python execution

```bash
cd backend
source venv/bin/activate  # or source .venv/bin/activate
python scripts/init_governance_content.py
```

#### Method 3: From any directory

```bash
cd backend
python -m scripts.init_governance_content
```

### Requirements

- Backend dependencies installed (`pip install -r requirements/base.txt`)
- Database configured (PostgreSQL or SQLite)
- Environment variables set (`.env` file)

### Output Example

```
==============================================================
GOVERNANCE LEARNING CONTENT - DATABASE INITIALIZATION
==============================================================

Creating database tables...
✓ Database tables ready

Clearing existing governance content...
✓ Existing content cleared

==============================================================
Creating: Section 1 - What is Governance?
==============================================================

✓ Created Board: Section 1: What is Governance?
  ✓ Created Module: Module 1.1 — Governance Foundations
    ✓ Created Topic: 1.1.1 Governance as "How Decisions Get Made"
    ✓ Created Topic: 1.1.2 Why Governance Matters for Community, Justice and Change
    ✓ Created Topic: 1.1.3 Different Cultural Worldviews of Governance
    ✓ Created Topic: 1.1.4 Governance in Action — Real-World Examples
    ✓ Created Topic: Glossary of Key Terms

==============================================================
✅ Database initialization completed successfully!
==============================================================

Created:
  • 1 Board
  • 1 Module
  • 5 Topics with full content
  • Multiple learning resources

✅ All done! The database is ready to use.

You can now:
  • Start the backend server
  • Navigate to Learning Hub
  • Access 'Section 1: What is Governance?'
```

### Troubleshooting

#### Import errors during development

The linter may show import errors like `"Board" is unknown import symbol`. These are false positives when the script is run from a different directory. The script handles the path correctly at runtime.

#### Database connection errors

Make sure your `.env` file has the correct `DATABASE_URL`:

```env
DATABASE_URL=postgresql://user:password@localhost/dbname
# or for SQLite:
DATABASE_URL=sqlite:///./app.db
```

#### Permission errors on macOS/Linux

Make the script executable:

```bash
chmod +x scripts/init_db.sh
```

### Modifying Content

To change the governance content:

1. Edit the script `init_governance_content.py`
2. Modify the `body_markdown`, `summary`, or `resources` fields
3. Run the script again to update the database

### Next Steps

After running this script:

1. **Start the backend server**:
   ```bash
   uvicorn app.main:app --reload
   ```

2. **Access the content**:
   - Go to the Learning Hub in the frontend
   - You'll see "Section 1: What is Governance?"
   - All topics are ready to explore

3. **Add more content**:
   - Use the Admin Panel to create additional boards/modules/topics
   - Or create more initialization scripts for other sections
