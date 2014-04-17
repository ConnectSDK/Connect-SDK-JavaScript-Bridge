#!/bin/sh

# Usage:
# 1. npm install -g minifier
# 2. chmod a+x ./tools/minify.sh
# 3. ./tools/minify.sh

# copy uncompressed JS file and apply header
cat ./license_header.txt > ../dist/connect_bridge.js
cat ../src/connect_bridge.js >> ../dist/connect_bridge.js

# set up minified JS file with header
cat ./license_header.txt > ../dist/connect_bridge.min.js

# minify JS file to tmp location
minify --output /tmp/connect_bridge.min.js ../src/connect_bridge.js

# copy minified JS file contents to min file
cat /tmp/connect_bridge.min.js >> ../dist/connect_bridge.min.js

# cleanup
rm /tmp/connect_bridge.min.js