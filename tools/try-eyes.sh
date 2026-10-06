#!/bin/bash
# 眼睛优化试验：在原有角色脸上，只重画眼睛，试三种高光/质感方向
# 用法：APINEBULA_KEY=xxx bash tools/try-eyes.sh
# 输出：temp/eyes-try/*.png（不入库）
KEY="${APINEBULA_KEY:?请先 export APINEBULA_KEY=你的密钥}"
REF="G:/Code/Agents/Custom/DobbyEmo/assets/sw/00.png"
OUT="G:/Code/Agents/Custom/DobbyEmo/temp/eyes-try"
mkdir -p "$OUT"

# 只改眼睛：保留猫耳、脸盘、笔记本、姿态、配色、渲染风格全部不动
BASE='Edit ONLY the two eyes on the face of the character in the reference image. Keep EVERYTHING else pixel-identical: the black cat-ear hood, the large cream-white oval face, the laptop, the claw, the tail, the floating purple code symbols, the purple background, the soft 3D vinyl render style, the lighting and the shadows.

The eyes must stay the SAME SHAPE and the SAME POSITION and the SAME SIZE as in the reference: two vertical rounded-rectangle capsule shapes, matte near-black, no outline.

New requirement — add the missing specular detail that makes eyes read as alive:'

gen() {
  local id="$1"; local detail="$2"
  if [ -s "$OUT/$id.png" ]; then echo "SKIP $id"; return 0; fi
  local prompt="$BASE $detail"
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

ITEMS=(
"a-gloss|a single small soft-edged white specular highlight dot near the upper-left of each eye, occupying about one fifth of the eye area, with a very subtle vertical brightness falloff making the eye surface read as slightly glossy rounded 3D vinyl. The highlight is soft, not a hard geometric circle."
"b-wet|a crisp bright white highlight near the upper-left of each eye plus a faint cool reflected-light rim along the lower-right edge of each eye, giving the eyes a wet glossy toy-visor quality. Keep it restrained, no lens flare."
"c-depth|no visible highlight dot, but give each eye a soft internal shading gradient so the eye reads as a rounded 3D dome recessed into the face, with the top-left slightly darker where the brow shadow falls and a gentle ambient-occlusion shadow where each eye meets the face."
)

pids=(); batch=0
for item in "${ITEMS[@]}"; do
  id="${item%%|*}"; detail="${item#*|}"
  gen "$id" "$detail" &
  pids+=($!)
  batch=$((batch+1))
done
wait
echo "=== DONE ==="
ls -la "$OUT"
