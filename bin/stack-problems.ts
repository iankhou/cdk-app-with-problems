#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { FailingCustomResourceStack } from '../lib/failing-custom-resource-stack';
import { IamDeniedCustomResourceStack } from '../lib/iam-denied-custom-resource-stack';
import { CrashingCustomResourceStack } from '../lib/crashing-custom-resource-stack';
import { VpcEniDeniedStack } from '../lib/vpc-eni-denied-stack';

const app = new cdk.App();

new FailingCustomResourceStack(app, 'FailingCustomResourceStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

new IamDeniedCustomResourceStack(app, 'IamDeniedCustomResourceStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

// Second instance for demonstrating the pre-CloudTrail "before" diagnosis output.
new IamDeniedCustomResourceStack(app, 'IamDeniedCustomResourceStackBefore', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

// Handler crashes after a denied call, without logging the cause or responding to CFN.
new CrashingCustomResourceStack(app, 'CrashingCustomResourceStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

// No custom resource at all: the Lambda service is denied ec2:CreateNetworkInterface on
// the function's behalf — only a CloudTrail window sweep can surface the root cause.
new VpcEniDeniedStack(app, 'VpcEniDeniedStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
