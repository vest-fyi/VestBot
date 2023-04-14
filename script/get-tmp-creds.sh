#!/usr/bin/env bash

# 0. check if DEV_ACCOUNT is present
if [[ -z "${DEV_ACCOUNT}" ]]; then
    echo >&2 "DEV_ACCOUNT is not set!"
    exit 1
else
    echo "DEV_ACCOUNT is set to $DEV_ACCOUNT"
fi

# 1. refresh SSO access token with aws sso login
unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY
unset AWS_SESSION_TOKEN

eval "$(aws2-wrap --profile AdministratorAccess-"$DEV_ACCOUNT" --export)" || echo "aws2-wrap exited with $?. Is it installed? Did you do 'aws configure sso' first?" >&2
