#!/bin/bash
if [ -n "$GOOGLE_SERVICES_JSON" ]; then
  echo "Writing google-services.json..."
  echo $GOOGLE_SERVICES_JSON | base64 -d > ./google-services.json
  echo "Done!"
fi
