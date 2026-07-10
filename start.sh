#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$ROOT_DIR/scripts/lib/i18n.sh"
sanaka_load_i18n

ACTION_ID=""
ACTION_LABEL=""
ACTION_COMMAND=()
ACTION_QEMU_PLATFORM=""
ACTION_RUN_DOCTOR_FIRST="false"
ACTION_BRANCH="main"
ACTION_COMMIT_MESSAGE="Update"
USE_WHIPTAIL="false"
WT_HEIGHT=20
WT_WIDTH=78
WT_MENU_HEIGHT=10

current_platform() {
  case "$(uname -s)" in
    Darwin) printf '%s\n' "macos" ;;
    Linux) printf '%s\n' "linux" ;;
    MINGW*|MSYS*|CYGWIN*) printf '%s\n' "windows" ;;
    *) printf '%s\n' "unknown" ;;
  esac
}

detect_ui_backend() {
  if command -v whiptail >/dev/null 2>&1; then
    USE_WHIPTAIL="true"
  fi
}

pause_line() {
  printf '\n'
}

wt_msgbox() {
  whiptail --title "$(sanaka_t "start.title")" --msgbox "$1" "$WT_HEIGHT" "$WT_WIDTH"
}

wt_inputbox() {
  local prompt="$1"
  local initial="${2:-}"
  whiptail --title "$(sanaka_t "start.title")" --inputbox "$prompt" "$WT_HEIGHT" "$WT_WIDTH" "$initial" 3>&1 1>&2 2>&3
}

wt_yesno() {
  whiptail --title "$(sanaka_t "start.title")" --yesno "$1" "$WT_HEIGHT" "$WT_WIDTH"
}

wt_menu() {
  local prompt="$1"
  shift
  whiptail --title "$(sanaka_t "start.title")" --menu "$prompt" "$WT_HEIGHT" "$WT_WIDTH" "$WT_MENU_HEIGHT" "$@" 3>&1 1>&2 2>&3
}

choose_language() {
  local choice
  if [[ "$USE_WHIPTAIL" == "true" ]]; then
    while true; do
      choice="$(wt_menu "$(sanaka_t "start.language_title")" \
        "1" "$(sanaka_t "start.language_option_1")" \
        "2" "$(sanaka_t "start.language_option_2")")" || exit 0
      case "$choice" in
        1) sanaka_set_lang "zh-CN"; wt_msgbox "$(printf "$(sanaka_t "common.language_switched")" "zh-CN")"; return 0 ;;
        2) sanaka_set_lang "en-US"; wt_msgbox "$(printf "$(sanaka_t "common.language_switched")" "en-US")"; return 0 ;;
      esac
    done
  fi
  while true; do
    pause_line
    printf '%s\n' "$(sanaka_t "start.language_title")"
    sanaka_printf_ln "start.language_option_1"
    sanaka_printf_ln "start.language_option_2"
    sanaka_printf "start.language_prompt"
    read -r choice || exit 0
    case "$choice" in
      1)
        sanaka_set_lang "zh-CN"
        sanaka_log "common.language_switched" "zh-CN"
        return 0
        ;;
      2)
        sanaka_set_lang "en-US"
        sanaka_log "common.language_switched" "en-US"
        return 0
        ;;
      *)
        sanaka_log "start.invalid_language"
        ;;
    esac
  done
}

ask_yes_no() {
  local prompt_key="$1"
  local answer
  if [[ "$USE_WHIPTAIL" == "true" ]]; then
    wt_yesno "$(sanaka_t "$prompt_key")"
    return $?
  fi
  while true; do
    sanaka_printf "common.yes_no" "$(sanaka_t "$prompt_key")"
    read -r answer || true
    case "${answer:-Y}" in
      Y|y|yes|YES|"") return 0 ;;
      N|n|no|NO) return 1 ;;
      *) sanaka_log "start.invalid_yes_no" ;;
    esac
  done
}

resolve_default_qemu_dir() {
  local platform="$1"
  local candidate

  case "$platform" in
    macos)
      for candidate in \
        "/Volumes/sks/src/qemu-11.0.1/build-sanaka" \
        "/Volumes/sks/src/qemu-stage" \
        "/opt/homebrew" \
        "/usr/local"; do
        [[ -d "$candidate" ]] && printf '%s\n' "$candidate" && return 0
      done
      ;;
    windows)
      for candidate in \
        "$HOME/sanaka/qemu/win" \
        "/c/Program Files/qemu" \
        "/c/Program Files/QEMU" \
        "/mnt/c/Program Files/qemu" \
        "/mnt/c/Program Files/QEMU" \
        "C:/Program Files/qemu" \
        "C:/Program Files/QEMU"; do
        [[ -d "$candidate" ]] && printf '%s\n' "$candidate" && return 0
      done
      ;;
  esac

  return 1
}

ask_qemu_dir() {
  local platform="$1"
  local default_qemu_dir entered

  default_qemu_dir="$(resolve_default_qemu_dir "$platform" || true)"

  if [[ "$USE_WHIPTAIL" == "true" ]]; then
    while true; do
      entered="$(wt_inputbox "$(sanaka_t "start.qemu_dir_question")${default_qemu_dir:+$'\n'$(printf "$(sanaka_t "start.qemu_dir_default")" "$default_qemu_dir")}" "$default_qemu_dir")" || return 1
      if [[ -z "$entered" ]]; then
        entered="$default_qemu_dir"
      fi
      if [[ -z "$entered" ]]; then
        wt_msgbox "$(sanaka_t "start.qemu_dir_missing")"
        continue
      fi
      if [[ ! -d "$entered" ]]; then
        wt_msgbox "$(printf "$(sanaka_t "start.qemu_dir_not_found")" "$entered")"
        continue
      fi
      printf '%s\n' "$entered"
      return 0
    done
  fi

  while true; do
    pause_line >&2
    sanaka_log "start.qemu_dir_question" >&2
    if [[ -n "$default_qemu_dir" ]]; then
      sanaka_log "start.qemu_dir_default" "$default_qemu_dir" >&2
    fi
    sanaka_printf "start.qemu_dir_prompt" >&2
    read -r entered || true
    if [[ -z "$entered" ]]; then
      entered="$default_qemu_dir"
    fi

    if [[ -z "$entered" ]]; then
      sanaka_log "start.qemu_dir_missing" >&2
      continue
    fi

    if [[ ! -d "$entered" ]]; then
      sanaka_log "start.qemu_dir_not_found" "$entered" >&2
      continue
    fi

    printf '%s\n' "$entered"
    return 0
  done
}

wizard_header() {
  local platform="$1"
  pause_line
  printf '%s\n' "$(sanaka_t "start.title")"
  sanaka_log "start.platform" "$platform"
  sanaka_log "start.language_current" "${SANAKA_ACTIVE_LANG:-unknown}"
}

apply_action_choice() {
  local choice="$1"
  case "$choice" in
    1)
      ACTION_ID="doctor-auto"
      ACTION_LABEL="$(sanaka_t "start.menu_1")"
      ACTION_COMMAND=(bash "$ROOT_DIR/scripts/doctor.sh" --auto)
      ACTION_QEMU_PLATFORM=""
      ACTION_RUN_DOCTOR_FIRST="false"
      return 0
      ;;
    2)
      ACTION_ID="doctor"
      ACTION_LABEL="$(sanaka_t "start.menu_2")"
      ACTION_COMMAND=(bash "$ROOT_DIR/scripts/doctor.sh")
      ACTION_QEMU_PLATFORM=""
      ACTION_RUN_DOCTOR_FIRST="false"
      return 0
      ;;
    3)
      ACTION_ID="start"
      ACTION_LABEL="$(sanaka_t "start.menu_3")"
      ACTION_COMMAND=(npm start)
      ACTION_QEMU_PLATFORM=""
      ACTION_RUN_DOCTOR_FIRST="false"
      return 0
      ;;
    4)
      ACTION_ID="build"
      ACTION_LABEL="$(sanaka_t "start.menu_4")"
      ACTION_COMMAND=(npm run build)
      ACTION_QEMU_PLATFORM=""
      ACTION_RUN_DOCTOR_FIRST="false"
      return 0
      ;;
    5)
      ACTION_ID="pack-mac-app"
      ACTION_LABEL="$(sanaka_t "start.menu_5")"
      ACTION_COMMAND=()
      ACTION_QEMU_PLATFORM="macos"
      ACTION_RUN_DOCTOR_FIRST="false"
      return 0
      ;;
    6)
      ACTION_ID="pack-mac-dmg"
      ACTION_LABEL="$(sanaka_t "start.menu_6")"
      ACTION_COMMAND=()
      ACTION_QEMU_PLATFORM="macos"
      ACTION_RUN_DOCTOR_FIRST="false"
      return 0
      ;;
    7)
      ACTION_ID="pack-win-dir"
      ACTION_LABEL="$(sanaka_t "start.menu_7")"
      ACTION_COMMAND=()
      ACTION_QEMU_PLATFORM="windows"
      ACTION_RUN_DOCTOR_FIRST="false"
      return 0
      ;;
    8)
      ACTION_ID="pack-win-installer"
      ACTION_LABEL="$(sanaka_t "start.menu_8")"
      ACTION_COMMAND=(npm run pack:win)
      ACTION_QEMU_PLATFORM=""
      ACTION_RUN_DOCTOR_FIRST="false"
      return 0
      ;;
    9)
      ACTION_ID="pack-linux"
      ACTION_LABEL="$(sanaka_t "start.menu_9")"
      ACTION_COMMAND=(npm run pack:linux)
      ACTION_QEMU_PLATFORM=""
      ACTION_RUN_DOCTOR_FIRST="true"
      return 0
      ;;
    10)
      ACTION_ID="pull"
      ACTION_LABEL="$(sanaka_t "start.menu_10")"
      ACTION_COMMAND=()
      ACTION_QEMU_PLATFORM=""
      ACTION_RUN_DOCTOR_FIRST="false"
      return 0
      ;;
    11)
      ACTION_ID="push"
      ACTION_LABEL="$(sanaka_t "start.menu_11")"
      ACTION_COMMAND=()
      ACTION_QEMU_PLATFORM=""
      ACTION_RUN_DOCTOR_FIRST="false"
      return 0
      ;;
    12)
      sanaka_log "common.exit"
      exit 0
      ;;
    *)
      return 1
      ;;
  esac
}

choose_action() {
  local choice
  if [[ "$USE_WHIPTAIL" == "true" ]]; then
    while true; do
      choice="$(wt_menu "$(sanaka_t "start.step_action")" \
        "1" "$(sanaka_t "start.menu_1")" \
        "2" "$(sanaka_t "start.menu_2")" \
        "3" "$(sanaka_t "start.menu_3")" \
        "4" "$(sanaka_t "start.menu_4")" \
        "5" "$(sanaka_t "start.menu_5")" \
        "6" "$(sanaka_t "start.menu_6")" \
        "7" "$(sanaka_t "start.menu_7")" \
        "8" "$(sanaka_t "start.menu_8")" \
        "9" "$(sanaka_t "start.menu_9")" \
        "10" "$(sanaka_t "start.menu_10")" \
        "11" "$(sanaka_t "start.menu_11")" \
        "12" "$(sanaka_t "start.menu_12")" \
        "L" "$(sanaka_t "start.menu_lang")")" || exit 0
      case "$choice" in
        L|l)
          choose_language
          continue
          ;;
        *)
          apply_action_choice "$choice" && return 0
          ;;
      esac
    done
  else
    while true; do
      pause_line
      sanaka_log "start.step_action"
      sanaka_printf_ln "start.menu_1"
      sanaka_printf_ln "start.menu_2"
      sanaka_printf_ln "start.menu_3"
      sanaka_printf_ln "start.menu_4"
      sanaka_printf_ln "start.menu_5"
      sanaka_printf_ln "start.menu_6"
      sanaka_printf_ln "start.menu_7"
      sanaka_printf_ln "start.menu_8"
      sanaka_printf_ln "start.menu_9"
      sanaka_printf_ln "start.menu_10"
      sanaka_printf_ln "start.menu_11"
      sanaka_printf_ln "start.menu_12"
      sanaka_printf "start.menu_prompt"
      read -r choice || exit 0
      case "$choice" in
        l|L|lang|language)
          choose_language
          ;;
        *)
          if apply_action_choice "$choice"; then
            return 0
          fi
          sanaka_log "start.invalid_menu"
          ;;
      esac
    done
  fi
}

configure_action() {
  local qemu_dir=""
  local branch=""
  local commit_message=""

  case "$ACTION_ID" in
    pull)
      if [[ "$USE_WHIPTAIL" == "true" ]]; then
        branch="$(wt_inputbox "$(sanaka_t "start.branch_question")" "$ACTION_BRANCH")" || return 1
      else
        pause_line
        sanaka_log "start.branch_question"
        sanaka_printf "start.branch_prompt"
        read -r branch || true
      fi
      branch="${branch:-main}"
      ACTION_BRANCH="$branch"
      ACTION_COMMAND=(bash "$ROOT_DIR/scripts/pull.sh" "$ACTION_BRANCH")
      ;;
    push)
      if [[ "$USE_WHIPTAIL" == "true" ]]; then
        branch="$(wt_inputbox "$(sanaka_t "start.branch_question")" "$ACTION_BRANCH")" || return 1
        commit_message="$(wt_inputbox "$(sanaka_t "start.commit_question")" "$ACTION_COMMIT_MESSAGE")" || return 1
      else
        pause_line
        sanaka_log "start.branch_question"
        sanaka_printf "start.branch_prompt"
        read -r branch || true
        pause_line
        sanaka_log "start.commit_question"
        sanaka_printf "start.commit_prompt"
        read -r commit_message || true
      fi
      branch="${branch:-main}"
      commit_message="${commit_message:-Update}"
      ACTION_BRANCH="$branch"
      ACTION_COMMIT_MESSAGE="$commit_message"
      ACTION_COMMAND=(bash "$ROOT_DIR/scripts/push.sh" "$ACTION_BRANCH" "$ACTION_COMMIT_MESSAGE")
      ;;
    start)
      if ask_yes_no "start.ask_run_doctor_first"; then
        ACTION_RUN_DOCTOR_FIRST="true"
      fi
      ;;
    pack-mac-app)
      qemu_dir="$(ask_qemu_dir "$ACTION_QEMU_PLATFORM")"
      ACTION_COMMAND=(bash "$ROOT_DIR/scripts/package-sanaka-macos.sh" "$qemu_dir")
      ;;
    pack-mac-dmg)
      qemu_dir="$(ask_qemu_dir "$ACTION_QEMU_PLATFORM")"
      ACTION_COMMAND=(bash "$ROOT_DIR/scripts/quick-build-macos-app.sh" "$qemu_dir")
      ;;
    pack-win-dir)
      qemu_dir="$(ask_qemu_dir "$ACTION_QEMU_PLATFORM")"
      ACTION_COMMAND=(bash "$ROOT_DIR/scripts/package-sanaka-windows.sh" "$qemu_dir")
      ;;
  esac
}

print_summary() {
  local summary
  if [[ "$USE_WHIPTAIL" == "true" ]]; then
    summary="$(printf "$(sanaka_t "start.summary_action")\n" "$ACTION_LABEL")"
    if [[ "$ACTION_ID" == "pull" || "$ACTION_ID" == "push" ]]; then
      summary+="$(
        printf "$(sanaka_t "start.summary_branch")\n" "$ACTION_BRANCH"
      )"
    fi
    if [[ "$ACTION_ID" == "push" ]]; then
      summary+="$(
        printf "$(sanaka_t "start.summary_commit")\n" "$ACTION_COMMIT_MESSAGE"
      )"
    fi
    if [[ "$ACTION_RUN_DOCTOR_FIRST" == "true" ]]; then
      summary+="$(
        printf "$(sanaka_t "start.summary_doctor_first")\n" "$(sanaka_t "start.enabled")"
      )"
    fi
    if [[ "${#ACTION_COMMAND[@]}" -gt 0 ]]; then
      summary+="$(
        printf "$(sanaka_t "start.summary_command")\n" "${ACTION_COMMAND[*]}"
      )"
    fi
    wt_msgbox "$summary"
    return 0
  fi
  pause_line
  sanaka_log "start.step_summary"
  sanaka_log "start.summary_action" "$ACTION_LABEL"
  if [[ "$ACTION_ID" == "pull" || "$ACTION_ID" == "push" ]]; then
    sanaka_log "start.summary_branch" "$ACTION_BRANCH"
  fi
  if [[ "$ACTION_ID" == "push" ]]; then
    sanaka_log "start.summary_commit" "$ACTION_COMMIT_MESSAGE"
  fi
  if [[ "$ACTION_RUN_DOCTOR_FIRST" == "true" ]]; then
    sanaka_log "start.summary_doctor_first" "$(sanaka_t "start.enabled")"
  fi
  if [[ "${#ACTION_COMMAND[@]}" -gt 0 ]]; then
    sanaka_log "start.summary_command" "${ACTION_COMMAND[*]}"
  fi
}

run_action() {
  pause_line
  sanaka_log "start.running" "$ACTION_LABEL"
  (
    cd "$ROOT_DIR"
    if [[ "$ACTION_RUN_DOCTOR_FIRST" == "true" ]]; then
      bash "$ROOT_DIR/scripts/doctor.sh" --auto --no-build
    fi
    "${ACTION_COMMAND[@]}"
    if [[ "$ACTION_ID" == "pack-win-installer" ]]; then
      echo
      sanaka_log "package_windows.installer_name"
      node "$ROOT_DIR/build/artifact-names.js" file win x64 exe
    fi
    if [[ "$ACTION_ID" == "pack-linux" ]]; then
      echo
      sanaka_log "package_linux.deb_name"
      node "$ROOT_DIR/build/artifact-names.js" file linux x64 deb
    fi
  )
}

main() {
  local platform
  platform="$(current_platform)"
  detect_ui_backend

  choose_language

  while true; do
    ACTION_ID=""
    ACTION_LABEL=""
    ACTION_COMMAND=()
    ACTION_QEMU_PLATFORM=""
    ACTION_RUN_DOCTOR_FIRST="false"
    ACTION_BRANCH="main"
    ACTION_COMMIT_MESSAGE="Update"

    wizard_header "$platform"
    choose_action
    configure_action
    print_summary

    if ask_yes_no "start.confirm_run"; then
      run_action
    fi

    if ! ask_yes_no "start.ask_again"; then
      sanaka_log "common.exit"
      exit 0
    fi
  done
}

main "$@"
