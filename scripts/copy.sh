#!/bin/bash

# Find the absolute path of the script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

# OpenMoji JSON data URL
DATA_URL="https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/data/openmoji.json"

# Default folder for renamed emojis, relative to ROOT_DIR
TARGET_FOLDER="$ROOT_DIR/src/emojis"

# Switch to ROOT_DIR for consistent behavior
cd "$ROOT_DIR"

# Ensure target folder exists
mkdir -p "$TARGET_FOLDER"

# Get total emojis to download
TOTAL_EMOJIS=$(curl -s "$DATA_URL" | jq -rc '.[]' | wc -l)

echo "Total Emojis to download: $TOTAL_EMOJIS"

# Counter for progress indication
COUNTER=0
TENTH_INTERVAL=$((TOTAL_EMOJIS / 10))  # Used to display percentages every 10%

MARKDOWN_FILE="$ROOT_DIR/emojis.md"

# Initialize markdown file
echo "| Emoji | Name |" > "$MARKDOWN_FILE"
echo "|:-----:|:----:|" >> "$MARKDOWN_FILE"

# Fetch the data and process
curl -s "$DATA_URL" | jq -rc '.[]' | while read -r emoji; do
    HEXCODE=$(echo "$emoji" | jq -r '.hexcode')
    ANNOTATION=$(echo "$emoji" | jq -r '.annotation')
    SLUG=$(echo "$ANNOTATION" | tr ' ' '_' | tr -d '\n\r:-')

    if [[ "$SLUG" != "" && "$SLUG" != "null" && "$HEXCODE" != "null" ]]; then
        # Fetch the emoji image and save with the new name
        EMOJI_URL="https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/svg/$HEXCODE.svg"
        curl -s -o "$TARGET_FOLDER/$SLUG.svg" "$EMOJI_URL"
        
        RELATIVE_PATH=${TARGET_FOLDER#"$ROOT_DIR/"}
        echo "| ![]($RELATIVE_PATH/$SLUG.svg) | $SLUG |" >> "$MARKDOWN_FILE"

        COUNTER=$((COUNTER + 1))
        
        # Print dot for each emoji downloaded
        echo -n "."
        
        # Print percentage every 10%
        if (( COUNTER % TENTH_INTERVAL == 0 )); then
            echo -n " $(($COUNTER * 100 / TOTAL_EMOJIS))%"
        fi
    else
        echo "Skipped due to missing or invalid data: $ANNOTATION ($HEXCODE)"
    fi
done

echo ""
echo "Emojis fetched, renamed, and saved successfully in $TARGET_FOLDER!"

# Return to the original directory
cd -
