#!/usr/bin/env python3
"""
Database Initialization Script for Governance Learning Content
Run this script to populate the database with Section 1: What is Governance?

Usage:
    cd backend
    python3 scripts/init_governance_content.py
"""

import sys
import os
import asyncio
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, delete
from app.core.db.db import AsyncSessionLocal, engine
from app.models.base import Base
from app.models.content import Board, Module, LearningTopic, LearningTopicContent
import uuid


# Content data structure
GOVERNANCE_CONTENT = {
    "board": {
        "name": "Section 1: What is Governance?",
        "sort_order": 1
    },
    "module": {
        "name": "Module 1.1 — Governance Foundations",
        "sort_order": 1
    },
    "topics": [
        {
            "title": '1.1.1 Governance as "How Decisions Get Made"',
            "sort_order": 1,
            "summary": "Governance is about how organisations make decisions, who makes them, and how they are held accountable. It ensures clarity, fairness, and sustainability.",
            "body_markdown": """# Governance as "How Decisions Get Made"

At its core, **governance** means the way decisions are made, who makes them, and how they are held to account.

Governance refers to how an organisation is **directed and controlled**. It covers the structures, rules, and processes through which decisions are made, and authority is exercised.

In simple terms, governance determines **who has power, who makes decisions, and how those decisions are monitored** in an organisation.

## What Good Governance Looks Like

Good governance is important because it brings **order and accountability** to organisations. It ensures the board of directors acts responsibly, makes decisions in the best interests of the organisation, and considers the interests of those affected by the organisation's actions (owners, employees, customers, and the public).

## In Practice, Governance Involves

### 1. **Direction**
Setting the vision, strategy and goals for an organisation.

### 2. **Control**
Ensuring decisions are made collectively and implemented properly, and that risks are managed.

### 3. **Accountability**
Reporting and being answerable to those affected — members, funders, communities, or the public.

## Why This Matters

Governance affects every kind of organisation — from a family-run business to a youth charity, a sporting association, or a global company. It is what makes decision-making **organised, ethical, and sustainable**.

Poor governance leads to confusion, risk, and sometimes crisis. The **2019 Banking Royal Commission** revealed how weak governance and poor culture in major Australian banks caused real harm — charging fees to deceased customers and prioritising profits over fairness.

---

### 🤔 Reflection
Think about a group or team you have been part of. How were decisions made? Were they fair and transparent? Who had the final say?
""",
            "resources": [
                {"title": "What is Governance? (YouTube)", "url": "https://youtu.be/QNYMsCpX7Rw"},
                {"title": "Justice Connect – What Does Not-For-Profit Mean?", "url": "https://www.nfplaw.org.au/free-resources/getting-started/what-does-not-for-profit-mean"}
            ]
        },
        {
            "title": "1.1.2 Why Governance Matters for Community, Justice and Change",
            "sort_order": 2,
            "summary": "Good governance protects fairness, prevents harm, and empowers communities. It ensures decisions are made ethically and inclusively.",
            "body_markdown": """# Why Governance Matters for Community, Justice and Change

Governance is not only about boards and rules — **it's about power, voice, and impact**.

Decisions made in meeting rooms affect people's lives: what services are funded, how workplaces operate, who gets a voice, and who doesn't.

## Strong Governance Helps To

✅ **Protect fairness and justice**  
✅ **Prevent misuse of money or authority**  
✅ **Create safer, more inclusive communities**  
✅ **Ensure long-term sustainability**

## Real-World Impact

In the **not-for-profit and community sector**, good governance can mean ensuring funds reach those in need or that programs genuinely empower people.

In **business**, it can mean balancing profit with social and environmental responsibility.

### 🟢 Example
A youth housing charity that includes people with lived experience of homelessness on its board is practising **inclusive governance** — its decisions are better informed and more just.

## The Cost of Weak Governance

Weak governance often harms the very people an organisation exists to serve. When boards fail to act ethically, ignore community voices, or avoid accountability, **public trust erodes**.

History shows that when companies are poorly governed, the consequences can be severe. Widespread misconduct in the Australian banking sector led to a **Royal Commission in 2019**, highlighting the poor practices of some banks in Australia.

In short, governance affects not just an organisation's success, but also **employees' jobs, investors' money, the quality of community services and the broader public interest**.

## Governance for Systems Change

Governance can also be a tool for **re-imagining how power works**. By bringing young people, First Nations leaders, and people with lived experience into decision-making spaces, we can create fairer, more future-focused systems.

Inclusive governance challenges the idea that only certain types of experience or expertise "belong" on a board.

---

### 🤔 Reflection
- Think of an example of a company or not-for-profit organisation that acted unethically (against general ideas of right and wrong).
- Why do you think it's important that decisions affecting young people or communities include their voices? How might this change outcomes?
""",
            "resources": [
                {"title": "ABC - Banking Royal Commission: Unconscionable, corrupt, and sometimes unlawful", "url": "https://www.facebook.com/watch/?v=1237738753047410"},
                {"title": "Banking Royal Commission Final Report - Chapter 3: Westpac Overview", "url": "https://www.aph.gov.au/-/media/02_Parliamentary_Business/24_Committees/243_Reps_Committees/Economics/45p/Four_Major_Banks_-_Fourth_Report/Chapter3.pdf"},
                {"title": "Governance Institute - Banking Royal Commission: Cultural Issues", "url": "https://www.governanceinstitute.com.au/news_media/banking-royal-commission-final-report-cultural-issues-and-implications/"}
            ]
        },
        {
            "title": "1.1.3 Different Cultural Worldviews of Governance",
            "sort_order": 3,
            "summary": "Governance systems reflect cultural values. Western models emphasise individual rights and ownership, while Indigenous governance values collective stewardship and relationality.",
            "body_markdown": """# Different Cultural Worldviews of Governance

Much of the governance taught in Australia today comes from **Western legal traditions**, particularly British corporate law that evolved as trade and empire expanded in the 18th to 20th centuries.

These systems value:
- Individual rights
- Ownership
- Competition
- Private property

They define organisations as **separate legal entities** — "artificial persons" that can own property, sue and be sued, and exist independently of the people within them. This idea made modern business possible but also shaped how society understands responsibility and power.

## However, This is Only One Worldview

Across cultures, governance has long taken different forms:

### 🌏 Indigenous Governance
Grounded in **kinship, Country, reciprocity, and collective stewardship**. Decisions are made relationally — with attention to balance, care, and respect for past and future generations.

### 🤝 Collective or Community Governance
Common in cooperatives, social enterprises, and community groups, where members **share responsibility and voice**.

### 🏢 Western Corporate Governance
Centred on **ownership, hierarchy, and formal rules**; it privileges structure and efficiency but can overlook relationships and context.

## The Impact of Colonisation

As European law spread through colonisation, Western governance models were exported — often **imposed** — across the world, replacing or marginalising Indigenous systems.

This process of legal colonisation **displaced or marginalised many Indigenous and community-based systems** of law and governance. Even today, most corporate laws globally (including Australia's **Corporations Act 2001**) are built on these imported British foundations.

## A Path Forward

Understanding this history helps us see that **governance is not neutral**: it reflects cultural values about power and responsibility.

A **decolonising approach** to governance invites us to learn from both traditions — combining the accountability and clarity of Western models with the relational wisdom and collective responsibility found in Indigenous ways of knowing.

Ultimately, governance is about **how we make decisions together — and for whom**. Strong, inclusive governance builds trust and stability, but it must also reflect the diversity of the societies it serves.

---

### 🤔 Reflection
- Think about your upbringing. What values were you brought up with? How do these values impact your decisions?
- Are they different to values of individualism?
- What other cultural or community ways of governing could be recognised or restored alongside these systems?
- How might inclusive governance draw strength from both Western and Indigenous traditions?
""",
            "resources": [
                {"title": "Justice Connect – Not for Profit Law Resources", "url": "https://www.nfplaw.org.au/free-resources"}
            ]
        },
        {
            "title": "1.1.4 Governance in Action — Real-World Examples",
            "sort_order": 4,
            "summary": "Governance principles apply across all sectors — from youth councils to multinational companies. It's about turning purpose into practice through fair, accountable decision-making.",
            "body_markdown": """# Governance in Action — Real-World Examples

Governance looks different depending on the organisation, but the principles remain the same: **clarity of purpose, fairness, accountability, and transparency**.

## Examples Across Different Sectors

| Example | Type of Organisation | Governance in Action |
|---------|---------------------|---------------------|
| **Youth Council** | Local-government advisory group | Young members set priorities and advise councillors on youth issues, ensuring decisions reflect lived experience. |
| **Community Sports Club** | Incorporated Association (NFP) | The elected committee follows a constitution, manages finances, and upholds fair play and inclusion. |
| **Charity Board** | Registered NFP with ACNC | Oversees fundraising ethics, compliance, and program impact — balancing community needs and donor trust. |
| **Qantas Board of Directors** | Public Company | Oversees strategy, finances, and corporate culture. In 2023 it faced scrutiny for decisions about executive pay and public trust. |
| **BHP Group** | Multinational Corporation | Operates across jurisdictions; governance includes environmental, social, and legal accountability globally. |

## What This Shows

These examples show that **governance isn't abstract** — it shapes real outcomes. Whether you're running a community group or leading a global company, governance is how you turn purpose into practice.

## Key Takeaways

✅ Governance applies to **all types of organisations** — from small community groups to global corporations  
✅ Good governance requires **transparency, accountability, and ethical decision-making**  
✅ **Inclusive governance** brings diverse voices into decision-making spaces  
✅ Poor governance can cause real harm to communities, employees, and public trust

---

### 🤔 Reflection
Think about an organisation you're familiar with. How does its governance structure affect the decisions it makes? Who has power, and who should have a voice?
""",
            "resources": [
                {"title": "Governance Institute of Australia", "url": "https://www.governanceinstitute.com.au/"}
            ]
        },
        {
            "title": "Glossary of Key Terms",
            "sort_order": 5,
            "summary": "Key terms and definitions for understanding governance concepts.",
            "body_markdown": """# Glossary of Key Terms

## Accountability
**Definition:** The responsibility of individuals or organisations to explain their decisions and actions to others who have a right to know.

In governance, accountability means being answerable for what decisions are made and how resources are managed — not just to shareholders, but also to the community, funders, and other stakeholders.

**Example:** A company board is accountable to its shareholders, regulators, and the public for ensuring the organisation complies with the law and achieves its stated purpose.

---

## Board of Directors
**Definition:** The group of people elected or appointed to make decisions for the organisation related to its strategic direction, risk management, finances and governance.

The board ensures the organisation acts to fulfill its purpose, its resources are used responsibly, and the relevant laws are followed.

**Example:** The Qantas Board of Directors faced intense public scrutiny in 2023 after it made decisions about executive bonuses.

---

## Not-for-Profit (NFP) Organisation
**Definition:** An organisation that exists to achieve a social, cultural, environmental, or community purpose rather than to make a profit for owners or shareholders.

Any surplus funds made by the organisation must be reinvested back into its work rather than distributed to persons within the organisation.

**Example:** Charities, community associations, and social enterprises can be registered under the Australian Charities and Not-for-profits Commission (ACNC). The Red Cross, St Vincent de Paul Society, and Beyond Blue are Australian NFPs that use their funds to deliver services, not to pay dividends to members.

---

## Multinational Company
**Definition:** A for-profit organisation that operates in more than one country, usually with headquarters in one location and subsidiaries or branches elsewhere.

Multinational companies raise complex governance issues because they are generally only subject to the laws of the countries in which they operate.

**Example:** The headquarters of companies such as BHP and Rio Tinto are in Australia but they have operations across multiple continents. There will be separate companies set up in each country that are part of the BHP or Rio Tinto corporate group and these companies will be subject to laws in the countries in which they operate.

---

## Ethical Decision-Making
**Definition:** A process of decision making that takes account of broader issues than just profit making or compliance with the law and takes account of values such as honesty, fairness, respect, and integrity.

In governance, ethical decision-making means considering how an organisation's actions will affect others and whether decisions align with the organisation's purpose and principles.

**Example:** A board deciding whether to accept funding from a company linked to environmental harm would involve ethical issues alongside financial benefit.

---

## Sustainability
**Definition:** Acting in a way that considers both present needs and the organisation's viability in the future, including the impact of the actions on future generations.

Sustainability extends beyond environmental care — it includes financial, social, and cultural sustainability.

**Example:** Many Australian superannuation funds now adopt ESG (Environmental, Social and Governance) principles to ensure the investments they make are not only financially sound but also socially and environmentally positive and responsible.
""",
            "resources": []
        }
    ]
}


async def init_database():
    """Create all tables if they don't exist"""
    print("Creating database tables...")
    
    from sqlalchemy import text, inspect
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Ensure is_active column exists in learning_topics
        # Check if column exists
        def check_and_add_column(sync_conn):
            inspector = inspect(sync_conn)
            columns = [col['name'] for col in inspector.get_columns('learning_topics')]
            
            if 'is_active' not in columns:
                # Column doesn't exist, add it
                sync_conn.execute(
                    text("ALTER TABLE learning_topics ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL")
                )
                sync_conn.commit()
                print("  ✓ Added is_active column to learning_topics")
        
        try:
            await conn.run_sync(check_and_add_column)
        except Exception as e:
            # Continue if column already exists
            print(f"  (Column check: {type(e).__name__})")
    
    print("✓ Database tables ready")


async def clear_existing_data():
    """Remove existing governance content to start fresh"""
    print("\nClearing existing governance content...")
    
    from sqlalchemy import text
    
    async with AsyncSessionLocal() as db:
        try:
            # Use raw SQL to delete governance board and cascade
            # This bypasses ORM relationship issues
            await db.execute(
                text("DELETE FROM boards WHERE name = :name"),
                {"name": GOVERNANCE_CONTENT["board"]["name"]}
            )
            await db.commit()
        except Exception as e:
            print(f"  (Note: {type(e).__name__} - may indicate no existing content to clear)")
            await db.rollback()
    
    print("✓ Existing content cleared")


async def create_governance_content():
    """Create the governance learning content structure"""
    
    print("\n" + "="*60)
    print("Creating: Section 1 - What is Governance?")
    print("="*60)
    
    async with AsyncSessionLocal() as db:
        # Create Board
        board = Board(
            id=str(uuid.uuid4()),
            name=GOVERNANCE_CONTENT["board"]["name"],
            sort_order=GOVERNANCE_CONTENT["board"]["sort_order"]
        )
        db.add(board)
        await db.flush()
        print(f"\n✓ Created Board: {board.name}")
        
        # Create Module
        module = Module(
            id=str(uuid.uuid4()),
            board_id=board.id,
            name=GOVERNANCE_CONTENT["module"]["name"],
            sort_order=GOVERNANCE_CONTENT["module"]["sort_order"]
        )
        db.add(module)
        await db.flush()
        print(f"  ✓ Created Module: {module.name}")
        
        # Create Topics
        for topic_data in GOVERNANCE_CONTENT["topics"]:
            topic = LearningTopic(
                id=str(uuid.uuid4()),
                module_id=module.id,
                name=topic_data["title"],
                sort_order=topic_data["sort_order"],
                pass_threshold=0.70,
                is_active=True
            )
            db.add(topic)
            await db.flush()
            
            # Create LearningTopicContent
            content = LearningTopicContent(
                id=str(uuid.uuid4()),
                topic_id=topic.id,
                body_format="markdown",
                body_markdown=topic_data["body_markdown"],
                summary=topic_data["summary"],
                resources=topic_data["resources"] if topic_data["resources"] else None
            )
            db.add(content)
            print(f"    ✓ Created Topic: {topic.name}")
        
        # Commit all changes
        await db.commit()
    
    print("\n" + "="*60)
    print("✅ Database initialization completed successfully!")
    print("="*60)
    print(f"\nCreated:")
    print(f"  • 1 Board")
    print(f"  • 1 Module")
    print(f"  • {len(GOVERNANCE_CONTENT['topics'])} Topics with full content")
    print(f"  • Multiple learning resources")


async def main():
    """Main execution function"""
    print("\n" + "="*60)
    print("GOVERNANCE LEARNING CONTENT - DATABASE INITIALIZATION")
    print("="*60)
    
    try:
        # Initialize database
        await init_database()
        
        # Clear and recreate content
        await clear_existing_data()
        await create_governance_content()
        
        print("\n✅ All done! The database is ready to use.")
        print("\nYou can now:")
        print("  • Start the backend server")
        print("  • Navigate to Learning Hub")
        print("  • Access 'Section 1: What is Governance?'")
        
    except Exception as e:
        print(f"\n❌ Error during initialization: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
