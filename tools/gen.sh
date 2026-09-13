#!/bin/bash
# Generate Dobby emote set via apinebula gpt-image-2 edits API, using temp/dobby/dobby.png as character reference.
KEY="${APINEBULA_KEY:?请先 export APINEBULA_KEY=你的密钥}"
REF="G:/Code/Agents/Custom/DobbyEmo/temp/dobby/dobby.png"
OUT="G:/Code/Agents/Custom/DobbyEmo/assets/emotes"
mkdir -p "$OUT"

PREFIX="Based on the character in the reference image (a cute black 3D mascot with a white oval face mask and two black oval eyes, wearing a black hood with cat-ear-like corners): render ONLY the head of this exact same character with"
SUFFIX="Keep the white face mask, black hood and 3D soft vinyl toy style exactly the same as the reference. Head centered and filling most of the frame, fully transparent background (alpha channel), no purple background, no body, no other objects, no text, no watermark."

gen() {
  local id="$1"; local expr="$2"
  if [ -s "$OUT/$id.png" ]; then echo "SKIP $id"; return 0; fi
  local prompt="$PREFIX $expr $SUFFIX"
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
      if [ -s "$OUT/$id.png" ]; then echo "OK   $id"; return 0; fi
    fi
    echo "RETRY($attempt) $id :: $(printf '%s' "$resp" | head -c 200)"
    sleep 6
  done
  echo "FAIL $id"
  return 1
}

# id|expression — 00-09 lifecycle, 10-29 emotions, 30-49 agent states
ITEMS=(
"idle|a calm neutral expression, two black oval eyes exactly like the reference"
"sleep|a peacefully sleeping expression, eyes drawn as two gentle downward-curved closed lines with small lashes"
"laugh|a joyful laughing expression, eyes squeezed into two happy > < shapes and a wide open laughing mouth on the face mask"
"love|both eyes replaced by two glossy red hearts, in-love expression"
"excited|both eyes replaced by two shiny golden stars, super excited expression"
"surprised|a surprised expression, eyes wide open as two large round white circles with tiny pupils, small round O mouth"
"angry|an angry expression, two sharp slanted V-shaped angry eyes with furrowed brow feel, slightly puffed"
"sad|a sad expression, two droopy inverted-arc eyes with raised inner corners, melancholy"
"cry|a crying expression, squeezed sad eyes with two big glossy blue tear drops streaming down the face mask"
"shy|a bashful expression, eyes looking away to the side and two soft pink blush marks on the cheeks of the face mask"
"cool|a confident cool expression wearing sleek black sunglasses over the face mask"
"wink|a playful wink, one oval eye open and the other eye a curved winking arc"
"thinking|a thoughtful expression, one oval eye open while the other eye half-closed looking upward, pondering"
"searching|a curious searching expression, both oval eyes glancing sideways to the right"
"error|a dizzy error expression, both eyes drawn as two black X shapes, stunned"
"success|a confident successful expression, determined happy eyes plus small colorful sparkles around the head"
"loading|a hypnotized processing expression, both eyes drawn as two spiral patterns, dazed"
)

pids=()
batch=0
for item in "${ITEMS[@]}"; do
  id="${item%%|*}"; expr="${item#*|}"
  gen "$id" "$expr" &
  pids+=($!)
  batch=$((batch+1))
  if [ $((batch % 4)) -eq 0 ]; then wait; fi
done
wait
echo "=== DONE ==="
ls -la "$OUT"
