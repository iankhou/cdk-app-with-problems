#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { FailingCustomResourceStack } from '../lib/failing-custom-resource-stack';

const app = new cdk.App();

new FailingCustomResourceStack(app, 'FailingCustomResourceStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
