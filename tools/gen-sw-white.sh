#!/bin/bash
# 生成白色版软件部表情（以已生成的白色 idle 为基准，仅改表情）
KEY="${APINEBULA_KEY:?请先 export APINEBULA_KEY=你的密钥}"
REF="G:/Code/Agents/Custom/DobbyEmo/assets/sw-white/00.png"
OUT="G:/Code/Agents/Custom/DobbyEmo/assets/sw-white"
mkdir -p "$OUT"

BASE='Based on the character in the reference image (a cute CREAM WHITE 3D mascot with an ivory oval face mask, sitting with a laptop): change ONLY the facial expression. Keep everything else EXACTLY the same: cream white body color, ivory face mask with subtle grey contour, sitting pose, dark grey laptop, floating purple code symbols, 3D soft vinyl toy style. Also keep the background FULLY TRANSPARENT (alpha). The expression:'

gen() {
  local id="$1"; local expr="$2"
  if [ -s "$OUT/$id.png" ]; then echo "SKIP $id"; return 0; fi
  local prompt="$BASE $expr"
  local resp url attempt
  for attempt in 1 2 3; do
    resp=$(curl -s -X POST "https://img-api.apinebula.ai/v1/images/edits" \
      -H "Authorization: Bearer $KEY" \
      -F "model=gpt-image-2" \
      -F "prompt=$prompt" \
      -F "size=1024x1024" \
      -F "quality=high" \
      -F "response_format=url" \
      -F "input_fidelity=high" \
      -F "background=transparent" \
      -F "image=@$REF")
    url=$(printf '%s' "$resp" | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$url" ]; then
      curl -s -o "$OUT/$id.png" "$url"
      if file "$OUT/$id.png" | grep -q RGBA; then echo "OK   $id"; return 0; fi
      echo "NOT-RGBA($attempt) $id"
    else
      echo "RETRY($attempt) $id :: $(printf '%s' "$resp" | head -c 150)"
    fi
    sleep 6
  done
  echo "FAIL $id"
  return 1
}

ITEMS=(
"01|eyes drawn as two gentle downward-curved closed lines with small lashes, peacefully sleeping relaxed face, tiny relaxed mouth"
"10|eyes become two upward-curved happy arcs (like ^ ^), with a small content closed smile, no open mouth"
"11|eyes become two upward-curved happy arcs (like ^ ^) and a big joyful open laughing mouth with pink tongue"
"12|both eyes replaced by two glossy red hearts, in-love happy expression with a big joyful smile"
"13|both eyes replaced by two shiny golden stars, super excited expression with wide open happy mouth"
"14|eyes wide open as two large round circles, very surprised expression with a small round O mouth"
"15|two sharp slanted V-shaped angry eyes with furrowed feel, angry expression with a wavy displeased mouth"
"16|two droopy inverted-arc sad eyes with raised inner corners, sad expression with a small wavy downturned mouth"
"17|two squeezed sad eyes with two big glossy blue tear drops streaming down the face, crying expression with an open wailing mouth"
"18|bashful eyes looking away to the side, two soft pink blush marks on the cheeks of the face mask, a shy small smile"
"19|wearing sleek black sunglasses over the face mask, confident cool expression with a smirk"
"20|one oval eye open and the other eye a curved winking arc, playful winking expression with a cheerful smile"
"30|one oval eye open while the other eye half-closed looking upward, thoughtful pondering expression with a flat small mouth"
"31|both oval eyes glancing sideways to the right, curious searching expression with a small curious mouth"
"32|both eyes drawn as two black X shapes, dizzy stunned error expression with a flat stunned mouth"
"33|two determined confident happy eyes, successful expression with a big proud smile and small colorful sparkles floating around the head"
"34|both eyes drawn as two spiral patterns, hypnotized dazed processing expression with a slightly open dazed mouth"
)

pids=(); batch=0
for item in "${ITEMS[@]}"; do
  id="${item%%|*}"; expr="${item#*|}"
  gen "$id" "$expr" &
  pids+=($!)
  batch=$((batch+1))
  if [ $((batch % 4)) -eq 0 ]; then wait; fi
done
wait
echo "=== DONE ==="
ls "$OUT" | wc -l
