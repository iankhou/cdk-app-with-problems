import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class StackProblemsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'StackProblemsQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });

    /*
    new Bucket(this, 'SomeBucket', {
      bucketName: 'zomaareenbucket',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    */

    // new NestedStackWithBucket(this, 'NestyNest');
    // Create an ECS cluster
    const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 2 });

    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    // Add capacity to it
    /*
    cluster.addCapacity('DefaultAutoScalingGroupCapacity', {
      instanceType: new ec2.InstanceType("t2.xlarge"),
    });
    */

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
    });

    taskDefinition.addContainer('DefaultContainer', {
      image: ecs.ContainerImage.fromAsset(`${__dirname}/image`),
      memoryLimitMiB: 512,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'xyz',
      }),
    });

    // Instantiate an Amazon ECS Service
    new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition,
      minHealthyPercent: 100,
      // deploymentStrategy: ecs.DeploymentStrategy.ROLLING,
      circuitBreaker: {
        enable: true,
      },
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });
  }
}

class NestedStackWithBucket extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props?: cdk.NestedStackProps) {
    super(scope, id, props);

    new cdk.CfnWaitConditionHandle(this, 'WCH');

    new Bucket(this, 'SomeBucket', {
      bucketName: 'zomaareenbucket',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}