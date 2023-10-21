#!/bin/bash

# Find the absolute path of the script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

# OpenMoji JSON data URL
DATA_URL="https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/data/openmoji.json"

# Default folder for renamed emojis, relative to ROOT_DIR
TARGET_FOLDER="$ROOT_DIR/docs/emojis"
CACHE_FOLDER="$ROOT_DIR/.cache"

# Check for --use-cache flag
USE_CACHE=0
if [ "$1" == "--use-cache" ]; then
    USE_CACHE=1
fi

# Switch to ROOT_DIR for consistent behavior
cd "$ROOT_DIR"

rm -rf "$TARGET_FOLDER"

# Ensure target and cache folders exist
mkdir -p "$TARGET_FOLDER" "$CACHE_FOLDER"

# Get total emojis to download
TOTAL_EMOJIS=$(curl -s "$DATA_URL" | jq -rc '.[]' | wc -l)

echo "Total Emojis to download: $TOTAL_EMOJIS"

# Counter for progress indication
COUNTER=0
TENTH_INTERVAL=$((TOTAL_EMOJIS / 10))  # Used to display percentages every 10%

MARKDOWN_FILE="$ROOT_DIR/emojis.md"

# Initialize markdown file
echo "| Emoji | Name | Tags |" > "$MARKDOWN_FILE"
echo "|:-----:|:----:|:----:|" >> "$MARKDOWN_FILE"

# A function to make the text URL-friendly
sanitize_for_url() {
    local str="$1"
    # Convert to lowercase, remove special characters, and replace spaces, commas, and dashes with underscores
    echo "$str" | tr '[:upper:] ' '[:lower:]_' | sed -e 's/[^a-z0-9_]//g'
}

# Fetch the data and process
curl -s "$DATA_URL" | jq -rc '.[]' | while read -r emoji; do
    HEXCODE=$(echo "$emoji" | jq -r '.hexcode')
    ANNOTATION=$(echo "$emoji" | jq -r '.annotation')
    TAGS=$(echo "$emoji" | jq -r '.tags')
    
    SLUG=$(sanitize_for_url "$ANNOTATION")

    if [[ "$SLUG" != "" && "$SLUG" != "null" && "$HEXCODE" != "null" ]]; then
        # Check if the emoji exists in the cache
        if [ "$USE_CACHE" -eq 1 ] && [ -f "$CACHE_FOLDER/$HEXCODE.svg" ]; then
            # Copy from cache
            cp "$CACHE_FOLDER/$HEXCODE.svg" "$TARGET_FOLDER/$SLUG.svg"
        else
            # Fetch the emoji image, save in target and cache directories
            EMOJI_URL="https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/svg/$HEXCODE.svg"
            curl -s -o "$TARGET_FOLDER/$SLUG.svg" "$EMOJI_URL"
            cp "$TARGET_FOLDER/$SLUG.svg" "$CACHE_FOLDER/$HEXCODE.svg"
        fi
        
        RELATIVE_PATH=${TARGET_FOLDER#"$ROOT_DIR/"}
        echo "| ![]($RELATIVE_PATH/$SLUG.svg) | $SLUG | $TAGS |" >> "$MARKDOWN_FILE"

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
