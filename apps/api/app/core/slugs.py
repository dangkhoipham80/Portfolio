"""URL slugs for content rows.

Every public content row is addressable by slug so the frontend can link to
``/projects/food-forum`` instead of ``/projects/5``. Slugs are generated from
the title once, on create, and then left alone — regenerating one on every
title edit would silently break any link already published to it.
"""

import re
import unicodedata

_NON_WORD = re.compile(r"[^a-z0-9]+")
_TRIM = re.compile(r"^-+|-+$")

# NFKD splits a base letter from its accents, so "ễ" reduces to "e". It does not
# touch letters whose stroke is part of the glyph rather than a combining mark,
# and Vietnamese "Đ" is one: left alone it is dropped entirely, turning "Đăng"
# into "ang". That is the author's own name, so it gets mapped by hand.
_PRE_FOLD = str.maketrans({"Đ": "D", "đ": "d"})


def slugify(value: str, *, max_length: int = 255) -> str:
    """Reduce a title to a lowercase ASCII slug.

    Accents are folded rather than dropped, so "Phạm Đăng Khôi" becomes
    "pham-dang-khoi" and not "pham-ang-khoi" — the titles here are mostly
    English but the author's name is not, and a slug with letters missing is
    worse than a transliterated one.
    """
    folded = unicodedata.normalize("NFKD", value.translate(_PRE_FOLD))
    ascii_only = folded.encode("ascii", "ignore").decode("ascii")
    slug = _NON_WORD.sub("-", ascii_only.lower())
    slug = _TRIM.sub("", slug)[:max_length]
    return _TRIM.sub("", slug)


def unique_slug(db, model, value: str, *, exclude_id: int | None = None) -> str:
    """Return a slug for ``value`` that no other row of ``model`` holds.

    Collisions get a ``-2``, ``-3`` … suffix. This narrows the race window but
    does not close it; the unique index on the column is what actually
    guarantees correctness, and a concurrent insert will still raise there.
    Content is written by one admin, so that is an acceptable trade.
    """
    base = slugify(value) or "item"
    candidate = base
    suffix = 2

    while True:
        query = db.query(model).filter(model.slug == candidate)
        if exclude_id is not None:
            query = query.filter(model.id != exclude_id)
        if query.first() is None:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1
