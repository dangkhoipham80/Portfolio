#!/usr/bin/env python3
"""Load the real portfolio content into the database.

Until now every project, skill, certificate and career entry lived as a
hardcoded array inside the Vite components — the API served content tables that
nothing wrote to, and the site rendered content the API had never seen. This
script is the one-time bridge: it lifts that data out of the components so the
API becomes the source of truth and the frontend can be pointed at it.

Idempotent. Rows are keyed on slug, so a second run updates rather than
duplicates, and re-running after editing an entry here pushes the edit through.

    python scripts/seed_content.py
    python scripts/seed_content.py --dry-run    # print what would change
"""
import argparse
import os
import sys
from datetime import date, datetime, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.core.slugs import slugify
from app.models.portfolio import (
    CareerEntry,
    Certificate,
    Post,
    Project,
    ProjectStatus,
    Skill,
    SkillLevel,
    Tag,
)

# Every `image_url` below is None. The Vite components referenced paths under
# /assets/images/, but no image file has ever been committed to this repository —
# `git ls-files` finds zero of them and portfolio/frontend/public/assets is an
# empty directory. Seeding those paths anyway meant the web app requested five
# images that 404 on every page view. The original filenames are kept in the
# comments so they can be restored when the files actually land.
PROJECTS = [
    {
        "title": "Cenematic",
        "description": (
            "Cinematic is an online cinema ticket booking system built with Java "
            "Servlet and JSP, enabling users to browse movies, choose seats, and "
            "make secure bookings."
        ),
        "long_description": (
            "Cinematic is a web-based cinema ticket booking system developed as part "
            "of a Java Servlet & JSP course at FPT University. The platform allows "
            "users to explore movies, select showtimes and seats, and complete "
            "bookings through a secure interface. Administrators can efficiently "
            "manage show schedules, ticket slots, and user accounts."
        ),
        "image_url": None,  # /assets/images/cenematic.png — see note above
        "github_url": "https://github.com/dangkhoipham80/Cenematic",
        "live_url": None,
        "technologies": [
            "Java Servlet", "JSP", "HTML", "CSS", "JavaScript",
            "Bootstrap", "SQL Server", "Bcrypt", "jQuery",
        ],
        "features": [
            "Online cinema ticket booking",
            "Responsive and intuitive UI",
            "Admin panel for schedule management",
            "Secure login system with Bcrypt encryption",
            "Movie search functionality",
        ],
        "challenges": [
            "Implementing full CRUD operations for admin panel",
            "Integrating SMTP email service securely",
            "Creating responsive UI with Bootstrap",
            "Managing compatibility with Java libraries and Tomcat",
        ],
        "started_on": date(2024, 8, 11),
        "ended_on": date(2024, 9, 22),
        "status": ProjectStatus.COMPLETED,
        "featured": True,
        "order": 1,
    },
    {
        "title": "Feng Shui Koi",
        "description": (
            "The FengShui Koi Consulting System is a project that provides "
            "consultation on Feng Shui and compatibility for Koi fish and ponds."
        ),
        "long_description": (
            "The FengShui Koi Consulting System is a comprehensive web application "
            "designed to provide expert consultation on Feng Shui principles and "
            "compatibility for Koi fish and ponds. This project combines traditional "
            "Feng Shui wisdom with modern technology to help users create harmonious "
            "aquatic environments."
        ),
        "image_url": None,  # /assets/images/feng-shui-koi.png — see note above
        "github_url": (
            "https://github.com/dangkhoipham80/"
            "FA24_SE1854_SWP391_G8_FengShuiKoiConsultingSystem.git"
        ),
        "live_url": None,
        "technologies": [
            "FireBase", "Java Spring Boot", "MySQL", "React", "TypeScript",
            "HTML", "CSS",
        ],
        "features": [
            "Feng Shui pond analysis and recommendations",
            "Koi fish compatibility assessment",
            "Interactive consultation dashboard",
            "User account management",
            "Expert consultation booking",
            "Mobile-responsive design",
        ],
        "challenges": [
            "Implementing complex Feng Shui algorithms",
            "Managing real-time data synchronization",
            "Creating intuitive user experience",
            "Integrating multiple databases",
        ],
        "started_on": date(2024, 1, 15),
        "ended_on": date(2024, 3, 20),
        "status": ProjectStatus.COMPLETED,
        "featured": True,
        "order": 2,
    },
    {
        "title": "Portfolio",
        "description": (
            "This is my portfolio website. A project that focuses to show my "
            "Frontend skills and introduce myself."
        ),
        "long_description": (
            "A modern, responsive portfolio website built to showcase my technical "
            "skills and professional journey. This project demonstrates my "
            "proficiency in frontend development using cutting-edge technologies "
            "and design principles."
        ),
        "image_url": None,  # /assets/images/portfolio.png — see note above
        "github_url": "https://github.com/dangkhoipham80/portfolio",
        "live_url": "https://khoipham.vercel.app",
        "technologies": ["React", "TypeScript", "Tailwind CSS", "Vite", "Vercel"],
        "features": [
            "Interactive animated backgrounds",
            "Dynamic theme switching",
            "Responsive design across all devices",
            "Smooth page transitions",
            "Contact form with email integration",
            "Project showcase with filtering",
        ],
        "challenges": [
            "Creating smooth, performant animations",
            "Implementing complex CSS animations",
            "Optimizing for mobile performance",
            "Managing state across components",
        ],
        "started_on": date(2024, 3, 1),
        "ended_on": None,
        "status": ProjectStatus.IN_PROGRESS,
        "featured": False,
        "order": 3,
    },
    {
        "title": "EduPath",
        "description": (
            "EduPath is a smart platform that helps high school students explore "
            "universities, compare majors, and receive 24/7 career guidance."
        ),
        "long_description": (
            "EduPath is an educational platform designed to support Vietnamese high "
            "school students in researching university information, comparing "
            "admission scores, viewing score distributions, and receiving real-time "
            "career guidance. The platform is being built using scalable "
            "architecture and modern technologies to ensure high availability and "
            "performance."
        ),
        "image_url": None,  # /assets/images/edupath.png — see note above
        "github_url": "https://gitlab.com/fpt2843445/period_7/sba301/edupath",
        "live_url": None,
        "technologies": [
            "Java Spring Boot", "ReactTS", "FastAPI", "PostgreSQL", "MongoDB",
            "Minio", "Docker", "Kibana", "Elasticsearch", "Redis", "Kafka",
        ],
        "features": [
            "University admission score search by year and major",
            "Score distribution visualization (THPT exam)",
            "University and major comparison tool",
            "AI-powered career counseling chatbot",
            "Live advisor support available 24/7",
        ],
        "challenges": [
            "Data collection and integration from multiple sources",
            "Real-time score distribution updates",
            "AI model training and optimization",
            "User privacy and data security",
            "Scalable architecture for high traffic",
        ],
        "started_on": date(2024, 6, 8),
        "ended_on": date(2024, 7, 27),
        "status": ProjectStatus.COMPLETED,
        "featured": True,
        "order": 4,
    },
    {
        "title": "Food Forum",
        "description": (
            "Food Forum is a vibrant community platform for food lovers to share "
            "recipes, experiences, and engage in real-time conversations."
        ),
        "long_description": (
            "Food Forum is a social platform built for all cooking enthusiasts — "
            "regardless of skill level — to connect, share recipes, post food "
            "experiences, and join real-time conversations. The frontend is built "
            "with React, TypeScript and TailwindCSS on Vercel; the backend is "
            "FastAPI with WebSocket on AWS EC2 behind Nginx, backed by PostgreSQL "
            "hosted on Neon.tech."
        ),
        "image_url": None,  # /assets/images/foodforum.png — see note above
        "github_url": "https://gitlab.com/fpt2843445/period_7/swd392/food-forum",
        "live_url": None,
        "technologies": [
            "React", "TypeScript", "TailwindCSS", "FastAPI", "PostgreSQL",
            "WebSocket", "Firebase Auth", "AWS", "Vercel", "Neon.tech", "Nginx",
        ],
        "features": [
            "Post recipes and food experiences",
            "Comment, like, and interact with others",
            "Topic-based group chats and 1-on-1 messaging",
            "Real-time communication via WebSocket (FastAPI)",
            "User authentication via Firebase",
            "Content reporting and user feedback",
            "Admin dashboard for moderation",
            "Responsive UI with TailwindCSS",
        ],
        "challenges": [
            "Building real-time messaging using FastAPI WebSocket",
            "Securing backend with Firebase token verification",
            "Managing deployment via AWS & Nginx",
            "Database performance with large user-generated content",
            "Responsive design & real-time UX consistency",
        ],
        "started_on": date(2024, 5, 25),
        "ended_on": date(2024, 7, 27),
        "status": ProjectStatus.COMPLETED,
        "featured": True,
        "order": 5,
    },
]

# (name, category, level) in the order the Skills section renders them.
SKILLS = [
    ("HTML/CSS", "Frontend", SkillLevel.ADVANCED),
    ("JavaScript", "Frontend", SkillLevel.INTERMEDIATE),
    ("React", "Frontend", SkillLevel.INTERMEDIATE),
    ("Tailwind CSS", "Frontend", SkillLevel.BEGINNER),
    ("TypeScript", "Frontend", SkillLevel.BEGINNER),
    ("Bootstrap", "Frontend", SkillLevel.INTERMEDIATE),
    ("Java Spring Boot", "Backend", SkillLevel.INTERMEDIATE),
    ("FastAPI", "Backend", SkillLevel.INTERMEDIATE),
    ("MongoDB", "Database", SkillLevel.BEGINNER),
    ("PostgreSQL", "Database", SkillLevel.INTERMEDIATE),
    ("MySQL", "Database", SkillLevel.INTERMEDIATE),
    ("SQLite", "Database", SkillLevel.BEGINNER),
    ("Redis", "Database", SkillLevel.BEGINNER),
    ("AWS", "Cloud", SkillLevel.INTERMEDIATE),
    ("Azure", "Cloud", SkillLevel.INTERMEDIATE),
    ("Google Cloud", "Cloud", SkillLevel.BEGINNER),
    ("Firebase", "Cloud", SkillLevel.INTERMEDIATE),
    ("Docker", "DevOps", SkillLevel.INTERMEDIATE),
    ("Kubernetes", "DevOps", SkillLevel.BEGINNER),
    ("GitLab", "Tools", SkillLevel.INTERMEDIATE),
    ("GitHub", "Tools", SkillLevel.INTERMEDIATE),
    ("Vscode", "Tools", SkillLevel.INTERMEDIATE),
    ("Slack", "Tools", SkillLevel.BEGINNER),
]

CERTIFICATES = [
    {
        "title": "AWS Certified Cloud Practitioner",
        "issuer": "Amazon Web Services",
        "issue_date": datetime(2024, 3, 1),
        "credential_id": "AWS-123456",
        "credential_url": "https://www.credly.com/aws-certified-cloud-practitioner",
        "description": (
            "Foundational level certification demonstrating cloud fluency and AWS "
            "Cloud concepts."
        ),
        "category": "Cloud",
        "skills": ["Cloud Computing", "AWS", "Cloud Architecture"],
    },
    {
        "title": "Python for Data Science",
        "issuer": "IBM",
        "issue_date": datetime(2024, 2, 1),
        "credential_id": "IBM-789012",
        "credential_url": (
            "https://www.coursera.org/account/accomplishments/certificate/IBM-789012"
        ),
        "description": (
            "Comprehensive course covering Python programming for data analysis and "
            "visualization."
        ),
        "category": "Data Science",
        "skills": ["Python", "Data Science", "Data Analysis"],
    },
    {
        "title": "Spring Boot Developer",
        "issuer": "Udemy",
        "issue_date": datetime(2024, 1, 1),
        "credential_id": "UDEMY-345678",
        "credential_url": "https://www.udemy.com/certificate/UDEMY-345678",
        "description": (
            "Advanced Spring Boot development certification covering microservices "
            "and REST APIs."
        ),
        "category": "Backend",
        "skills": ["Java", "Spring Boot", "REST APIs"],
    },
    {
        "title": "React Developer Certification",
        "issuer": "Meta",
        "issue_date": datetime(2023, 12, 1),
        "credential_id": "META-456789",
        "credential_url": (
            "https://www.coursera.org/account/accomplishments/certificate/META-456789"
        ),
        "description": (
            "Professional certification in React development and frontend "
            "engineering."
        ),
        "category": "Frontend",
        "skills": ["React", "JavaScript", "Frontend Development"],
    },
    {
        "title": "Machine Learning Specialization",
        "issuer": "Stanford Online",
        "issue_date": datetime(2023, 11, 1),
        "credential_id": "STAN-234567",
        "credential_url": (
            "https://www.coursera.org/account/accomplishments/certificate/STAN-234567"
        ),
        "description": (
            "Comprehensive machine learning certification covering algorithms and "
            "practical applications."
        ),
        "category": "AI/ML",
        "skills": ["Machine Learning", "AI", "Data Analysis"],
    },
]

CAREER_ENTRIES = [
    {
        "title": "Python Developer Intern",
        "company": "FPT Software",
        "location": "Ho Chi Minh City, Vietnam",
        "started_on": date(2024, 12, 1),
        "ended_on": date(2025, 3, 31),
        "highlights": [
            "Developed and maintained RESTful APIs using Python and FastAPI",
            "Collaborated with cross-functional teams to implement new features",
            "Optimized database queries and improved application performance",
            "Participated in code reviews and implemented best practices",
        ],
    },
    {
        "title": "Software Engineering Student",
        "company": "FPT University",
        "location": "Ho Chi Minh City, Vietnam",
        "started_on": date(2022, 9, 1),
        "ended_on": None,  # Still ongoing; the frontend renders this as "Present".
        "highlights": [
            "Studying Software Engineering with focus on Backend Development",
            "Participated in various hackathons and coding competitions",
            "Developed personal projects to enhance technical skills",
            "Learning Data Science and AI concepts",
        ],
    },
]


# Bodies are Markdown; the web app renders them server-side through a
# sanitising pipeline. Each of these is about something that actually happened
# in this repository, which is the only kind of post worth putting on a
# portfolio — the commits are there to check them against.
#
# `published_at` is set explicitly rather than left to the service to stamp:
# these are being backfilled, so "now" would be a lie and would order them by
# whenever the seed happened to run.
POSTS = [
    {
        "title": "Every corner on my site was square for three weeks",
        "excerpt": (
            "Tailwind v4 compiled my design token to invalid CSS. Type-check, "
            "lint, build and a full frontend review all passed anyway."
        ),
        "tags": ["Tailwind", "CSS", "Debugging"],
        "published_at": datetime(2026, 8, 9, tzinfo=timezone.utc),
        "body": """\
The radius scale on this site lives in one place, as a set of custom properties
in `globals.css`:

```css
@theme {
  --radius-card: 0.875rem;
  --radius-control: 0.5rem;
  --radius-pill: 9999px;
}
```

Components then reach for a token instead of picking a number. That was the
theory. In practice every card, every button and every badge on the site had
perfectly square corners, and had done since the design system landed.

## What was actually emitted

The class was written `rounded-[--radius-card]`. Tailwind v4 treats the contents
of square brackets as a literal value and substitutes it directly, so what
reached the stylesheet was:

```css
border-radius: --radius-card;
```

That is not a length. It is not `var(--radius-card)`, it is the bare token name,
and the browser does what the spec tells it to do with a declaration it cannot
parse: it drops it silently. No console warning, no failed build. The element
falls back to `border-radius: 0` and looks deliberate.

The fix is four characters:

```
rounded-[var(--radius-card)]
```

## Why nothing caught it

This is the part worth keeping. The change passed `tsc`, ESLint, `next build`,
and a review pass by an agent that had screenshots of the rendered page in front
of it. Every one of those checks is looking at either the class name — which is
correct, the token exists and is spelled right — or at a page whose square
corners read as a design decision rather than a bug.

The check that would have caught it is the one nobody runs: opening devtools and
asking the element what its computed `border-radius` is.

```js
getComputedStyle(document.querySelector('.card')).borderRadius  // "0px"
```

I have since written that down as a rule in the repo's `CLAUDE.md`. When a token
stops applying, nothing fails loudly — so verify the emitted stylesheet, not the
class name.
""",
    },
    {
        "title": "A portfolio that stays up when its backend doesn't",
        "excerpt": (
            "This site replaced a static SPA that could not break. Adding a "
            "database was not allowed to take that away."
        ),
        "tags": ["Next.js", "FastAPI", "Reliability"],
        "published_at": datetime(2026, 8, 6, tzinfo=timezone.utc),
        "body": """\
The version of this portfolio before this one was a Vite SPA with every project,
skill and certificate hardcoded into a component array. It was unmaintainable,
and it had exactly one virtue: it could not go down for any reason short of
Vercel itself going down.

Moving the content into a Postgres database behind a FastAPI service gave me an
admin console and a content model. It also gave me a free-tier backend that goes
to sleep, and a new way for the front page to return a 500 — to a recruiter, on
the one visit I get.

## Every read has a fallback

So the fetch layer has one rule, applied without exception: a reader returns a
fallback rather than throwing.

```ts
export async function getProjects(): Promise<Project[]> {
  return getJson<Project[]>("/projects/", [], isList);
}
```

`getJson` catches connection refused, DNS failure and a five-second timeout, logs
the reason server-side so the failure is not actually silent, and hands back the
fallback. The page then renders an empty state that was designed rather than
left bare. A sleeping API costs a visitor a section, not the site.

## The failure I did not expect

The interesting case was not the backend being down. It was the backend being
*up* and answering with something else — a gateway returning `200` with a JSON
error body, a tunnel serving its own payload. `response.json()` returns `any`,
and the cast that follows it is a promise rather than a check. Hand a
list-shaped variable an object and the page throws on `.map()`.

That is a 500 caused by a successful request, which is the one failure mode the
rest of the module exists to rule out. So the shape is checked before the cast:

```ts
const isList: ShapeCheck = (data) => Array.isArray(data);
```

Cheap, and it closes the gap between "the request worked" and "the response is
what I said it was".
""",
    },
    {
        "title": "Make the safe thing the default: published-only reads",
        "excerpt": (
            "A visibility filter you have to remember to apply is a leak "
            "waiting for the day you forget."
        ),
        "tags": ["FastAPI", "Security", "API design"],
        "published_at": datetime(2026, 8, 2, tzinfo=timezone.utc),
        "body": """\
Every content table in this API has a `published` flag, and every read route is
world-readable. The only thing between an unfinished draft and the public
internet is a `WHERE published = true`.

The tempting shape is a parameter that turns the filter on:

```python
def get_projects(self, only_published: bool = False): ...
```

Written that way, a route that never thought about visibility leaks everything.
The failure is silent, it looks like working code, and you find out when a draft
shows up in a search result.

## Inverted, with the default on the safe side

```python
def get_projects(self, include_unpublished: bool = False) -> List[Project]:
    query = self.db.query(Project)
    if not include_unpublished:
        query = query.filter(Project.published.is_(True))
    ...
```

Now a caller that forgets to think about visibility gets the published set. To
see drafts you have to ask for them by name, in a way that is obvious in review.

The routes ask like this:

```python
service.get_projects(include_unpublished=viewer is not None)
```

where `viewer` comes from `get_optional_admin` — a dependency that returns the
admin if a valid token is present and `None` otherwise, and crucially does not
raise. A stale token in a visitor's browser must mean "anonymous", not "401";
otherwise one expired session breaks the whole public site.

## 404, not 403

One more detail that is easy to get wrong. Fetching a draft by id as an
anonymous caller returns 404, not 403. A 403 confirms that a row exists at that
id, and whether an unpublished post exists is itself not public information.

There are tests for each of these, asked from outside as an anonymous HTTP
client, because a filter exercised only by the code that sets it is not tested
at all.
""",
    },
]


def _upsert(db, model, key_field, key_value, values, dry_run):
    """Insert or update one row, reporting which it did."""
    existing = db.query(model).filter(getattr(model, key_field) == key_value).first()

    if existing is None:
        if not dry_run:
            db.add(model(**{key_field: key_value}, **values))
        return "create"

    changed = [f for f, v in values.items() if getattr(existing, f) != v]
    if not changed:
        return "unchanged"

    if not dry_run:
        for field, value in values.items():
            setattr(existing, field, value)
    return "update"


def _tag_for(db, name: str) -> Tag:
    """The tag row for a display name, creating it the first time.

    Looked up by slug rather than by name, so "Next.js" seeded here and a
    "next.js" already in the database are one tag rather than two that render
    identically and filter differently.
    """
    slug = slugify(name, max_length=120)
    existing = db.query(Tag).filter(Tag.slug == slug).first()
    if existing is not None:
        return existing

    created = Tag(slug=slug, name=name)
    db.add(created)
    db.flush()
    return created


def seed(dry_run: bool = False) -> None:
    db = SessionLocal()
    tally = {"create": 0, "update": 0, "unchanged": 0}

    def record(outcome, label):
        tally[outcome] += 1
        if outcome != "unchanged":
            print(f"  {outcome:9} {label}")

    try:
        print("Projects")
        for entry in PROJECTS:
            values = dict(entry, published=True)
            record(
                _upsert(db, Project, "slug", slugify(entry["title"]), values, dry_run),
                entry["title"],
            )

        print("Skills")
        for order, (name, category, level) in enumerate(SKILLS, start=1):
            # Skills have no slug — name is the natural key.
            values = {"category": category, "level": level, "order": order}
            record(_upsert(db, Skill, "name", name, values, dry_run), name)

        print("Certificates")
        for entry in CERTIFICATES:
            values = dict(entry, published=True)
            record(
                _upsert(db, Certificate, "slug", slugify(entry["title"]), values, dry_run),
                entry["title"],
            )

        print("Career entries")
        for entry in CAREER_ENTRIES:
            values = dict(entry, published=True)
            label = f"{entry['title']} @ {entry['company']}"
            record(
                _upsert(db, CareerEntry, "slug", slugify(label), values, dry_run),
                label,
            )

        print("Posts")
        for entry in POSTS:
            # Tags are rows, so they have to exist before a post can reference
            # them — and `tags` on the model is a relationship, so handing it a
            # list of strings raises rather than being coerced. Both are why the
            # key is lifted out of `values` here instead of going through
            # `_upsert` with everything else.
            names = entry.get("tags", [])
            values = {k: v for k, v in entry.items() if k != "tags"}
            values["published"] = True

            outcome = _upsert(db, Post, "slug", slugify(entry["title"]), values, dry_run)

            if not dry_run:
                # Flushed so a freshly-created post has an id to link against.
                db.flush()
                post = db.query(Post).filter(Post.slug == slugify(entry["title"])).one()
                post.tags = [_tag_for(db, name) for name in names]

            record(outcome, entry["title"])

        if dry_run:
            db.rollback()
            print(f"\nDry run — nothing written. {tally}")
        else:
            db.commit()
            print(f"\nDone. {tally}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="report what would change without writing",
    )
    seed(dry_run=parser.parse_args().dry_run)
