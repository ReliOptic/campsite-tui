#!/bin/bash
# S2 스파이크: Terminal.app OSC 52 지원 여부 실측 (throwaway)
printf '\033]52;c;%s\007' "$(printf 'CSTUI-TERMAPP-TEST' | base64)"
sleep 1
exit 0
