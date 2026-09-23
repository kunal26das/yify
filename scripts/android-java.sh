#!/usr/bin/env bash

android_java_home() {
  local candidate
  local detected_java_home
  detected_java_home=$(/usr/libexec/java_home -v 17 2>/dev/null || true)
  for candidate in "${JAVA_HOME:-}" \
                   "$detected_java_home" \
                   /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
                   /usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
                   "/Applications/Android Studio.app/Contents/jbr/Contents/Home"; do
    if [ -n "$candidate" ] && [ -x "$candidate/bin/javac" ] && "$candidate/bin/javac" -version 2>&1 | grep -Eq '^javac 17([.[:space:]]|$)'; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  echo "JDK 17 is required. Install it with: brew install openjdk@17, or set JAVA_HOME to a JDK 17 installation." >&2
  return 1
}

JAVA_HOME=$(android_java_home) || return 1
export JAVA_HOME
