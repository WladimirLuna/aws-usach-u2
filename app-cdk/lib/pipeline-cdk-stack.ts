import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';


interface ConsumerProps extends StackProps {
  ecrRepository: ecr.Repository,
}


export class PipelineCdkStack extends Stack {
  constructor(scope: Construct, id: string, props: ConsumerProps) {
    super(scope, id, props);

    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
        pipelineName: 'CICD_Pipeline',
    });

    const codeBuild = new codebuild.PipelineProject(this, 'CodeBuild', {
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
          privileged: true,
          computeType: codebuild.ComputeType.LARGE,
        },
        buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec_test.yml'),
    });

    const sourceOutput = new codepipeline.Artifact();
    const unitTestOutput = new codepipeline.Artifact();

    const githubSecret = secretsmanager.Secret.fromSecretNameV2(
        this,
        'GitHubToken',
        'github/token'
    );

    const dockerBuild = new codebuild.PipelineProject(this, 'DockerBuild', {
      environmentVariables: {
        IMAGE_TAG: { value: 'latest' },
        IMAGE_REPO_URI: { value: props.ecrRepository.repositoryUri },
        AWS_DEFAULT_REGION: { value: process.env.CDK_DEFAULT_REGION },
      },
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true,
        computeType: codebuild.ComputeType.LARGE,
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec_docker.yml'),
    });

    const dockerBuildRolePolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ['*'],
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:GetRepositoryPolicy',
        'ecr:DescribeRepositories',
        'ecr:ListImages',
        'ecr:DescribeImages',
        'ecr:BatchGetImage',
        'ecr:InitiateLayerUpload',
        'ecr:UploadLayerPart',
        'ecr:CompleteLayerUpload',
        'ecr:PutImage',
      ],
    });

    dockerBuild.addToRolePolicy(dockerBuildRolePolicy);

    const dockerBuildOutput = new codepipeline.Artifact();

    pipeline.addStage({
        stageName: 'Source',
        actions: [
          new codepipeline_actions.GitHubSourceAction({
            actionName: 'GitHub_Source',
            owner: 'WladimirLuna',
            repo: 'aws-usach-u2',
            branch: 'main',
            oauthToken: githubSecret.secretValueFromJson('github_token'),
            output: sourceOutput
          }),
        ],
    });

    pipeline.addStage({
        stageName: 'Code-Quality-Testing',
        actions: [
          new codepipeline_actions.CodeBuildAction({
            actionName: 'Unit-Test',
            project: codeBuild,
            input: sourceOutput,
            outputs: [unitTestOutput],
          }),
        ],
    });
  
    pipeline.addStage({
      stageName: 'Docker-Push-ECR',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Docker-Build',
          project: dockerBuild,
          input: sourceOutput,
          outputs: [dockerBuildOutput],
        }),
      ],
    });

  }
  
}
