import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AppCdkStack } from '../lib/app-cdk-stack';
import { PipelineCdkStack } from '../lib/pipeline-cdk-stack';
import { EcrCdkStack } from '../lib/ecr-cdk-stack';
import * as s3 from 'aws-cdk-lib/aws-s3';

const app = new cdk.App();

const ecrCdkStack = new EcrCdkStack(app, 'ecr-stack', {});

const s3BucketStack = new cdk.Stack(app, 's3-bucket-stack');
const s3Bucket = new s3.Bucket(s3BucketStack, 'DockerImageBucket', {
    removalPolicy: cdk.RemovalPolicy.DESTROY, // Adjust as needed
    autoDeleteObjects: true, // Adjust as needed
});

const testCdkStack = new AppCdkStack(app, 'test', {
    ecrRepository: ecrCdkStack.repository,
});

const pipelineCdkStack = new PipelineCdkStack(app, 'pipeline-stack', {
    ecrRepository: ecrCdkStack.repository,
    s3Bucket: s3Bucket,
    fargateServiceTest: testCdkStack.fargateService,
});