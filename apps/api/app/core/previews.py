"""How much of a long post an anonymous caller is given.

## Why the cut happens here rather than in the browser

Because a cut in the browser is not a cut. The obvious version of a login gate
is a gradient over the rest of the article and a sign-in panel on top of it —
which means the whole post was in the response, and "read the rest" is View
Source. If the hidden part is worth hiding it has to be absent, and the only
place it can be absent from is the payload.

So this runs in the API, on the way out, and the web app renders whatever it was
given. See ``Post.gated`` in schemas/portfolio.py for the flag that says a body
is short of its full length, and endpoints/posts.py for who gets which.

## What the cut is allowed to do to the Markdown

Nothing that changes how the part it keeps renders. Cutting a post at character
1800 is how a body ends in the middle of a fenced code block, which — because
the fence is never closed — makes every paragraph after it part of the code
block, except that there are no paragraphs after it, so the article simply ends
inside a grey box. Or it ends mid-table, or between a link's ``[text]`` and its
``(url)``.

The rule that avoids all of those without enumerating them: cut only at a blank
line, and count fences on the way so the cut is never inside one. A blank line
in Markdown is the one position where no construct is open — it is what
separates blocks in the first place.

## Why the cutoff is a character count and not a word count or a percentage

A percentage gives every post the same *proportion*, which means a 400-word
post is gated at 240 words for no reason and a 6000-word one hands over most of
itself before the gate. A word count reads well and is harder to reason about
against a body that is half code. Characters are what the reader actually meets
on the screen and what the setting can be sanity-checked against by opening one
post.
"""

import re
from typing import Tuple

# A fenced code block, opened and closed by ``` or ~~~. Only used by
# word_count; the preview cut tracks fences line by line instead, because it
# needs to know whether a *position* is inside one.
#
# The closing half is `[^\n]*$` and not `.*$`, which is the version this was
# written as first. With DOTALL, `.` matches a newline — so a greedy `.*` after
# the closing fence ran to the end of the document and took every word after the
# first code block with it. A 900-word post reported 40. Nothing failed; the
# reading estimate was simply wrong, and only on posts with code in them.
_FENCE = re.compile(r"^(```|~~~)[^\n]*\n.*?^\1[^\n]*$", re.MULTILINE | re.DOTALL)

# Below this, a post is not gated at all.
#
# Deliberately larger than the cutoff rather than equal to it. With the two the
# same, a post 20 characters over the line would hand back its opening and a
# sign-in wall in place of its last sentence, which is the most annoying
# possible version of this feature and buys nothing — nobody creates an account
# to read 20 characters. The gap means a gated post always has a substantial
# amount still behind the gate.
GATE_MINIMUM_MULTIPLIER = 2


def preview_of(body: str, cutoff: int) -> Tuple[str, bool]:
    """The publicly readable opening of ``body``, and whether anything was cut.

    Returns ``(body, False)`` unchanged for anything that is not long enough to
    be worth gating — see GATE_MINIMUM_MULTIPLIER.

    ``cutoff`` of zero or less switches gating off entirely, which is what makes
    the feature a setting rather than a redeploy: an operator who decides the
    blog should be fully public sets PUBLIC_PREVIEW_CHARS=0 and every post goes
    back to being whole.
    """
    if cutoff <= 0:
        return body, False

    if len(body) <= cutoff * GATE_MINIMUM_MULTIPLIER:
        return body, False

    cut = _last_safe_break(body, cutoff)

    # No blank line anywhere in the opening — a wall of text, or one very long
    # fenced block. Handing back nothing is worse than handing back nothing
    # gated: an empty article with a sign-in panel under it looks broken rather
    # than withheld. So the post is left whole and the caller is told it is not
    # gated, which is true.
    if cut <= 0:
        return body, False

    return body[:cut].rstrip(), True


def _last_safe_break(body: str, cutoff: int) -> int:
    """The offset of the last blank line at or before ``cutoff``, outside fences.

    Walks the lines rather than searching for "\\n\\n" backwards, because the
    fence state cannot be recovered from a position — it depends on how many
    fences were opened before it. The same walk answers both questions at once.
    """
    offset = 0
    safe = 0
    fenced = False

    for line in body.split("\n"):
        stripped = line.strip()

        # ``` and ~~~ both open and close a fence in CommonMark, and a fence can
        # be longer than three characters. Only the opener carries an info
        # string, so a bare check for the prefix is enough for both ends.
        if stripped.startswith("```") or stripped.startswith("~~~"):
            fenced = not fenced

        if offset > cutoff:
            break

        # A blank line outside a fence: every block above it is closed, so the
        # text up to here renders exactly as it does in the whole post.
        if not fenced and stripped == "":
            safe = offset

        offset += len(line) + 1  # the newline the split consumed

    return safe


def word_count(body: str) -> int:
    """Roughly how many words of prose the whole post is.

    Sent alongside every post so the web app can say "12 min" on one it has only
    been given the opening of. Without it a gated post would advertise the
    reading time of its own preview — wrong on the post itself, and actively
    misleading on an index, where it is the number that says which posts are the
    substantial ones.

    It is the count for the *whole* body in every response, gated or not, and
    that is the point: the estimate under a post must not change the moment its
    reader signs in.

    Fenced code is dropped before counting, matching ``plainText`` in the web
    app's lib/markdown.ts — a post that is half shell transcript is not credited
    with the minutes it would take to read the transcript aloud. The remaining
    syntax (backticks, brackets, emphasis) is left alone: it is attached to
    words rather than being words, so it does not move a whitespace count.
    """
    return len(_FENCE.sub(" ", body).split())
