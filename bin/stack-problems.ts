#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { FailingCustomResourceAdvancedLoggingStack2 } from '../lib/failing-custom-resource-stack';

const app = new cdk.App();

new FailingCustomResourceAdvancedLoggingStack2(app, 'FailingCustomResourceAdvancedLoggingStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
