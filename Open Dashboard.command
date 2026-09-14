#!/bin/bash
cd "$(dirname "$0")" || exit 1
exec ./dashboard/launch-control-desk.sh
