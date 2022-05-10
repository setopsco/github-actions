# Github Actions for SetOps

## Deployment Workflow

The repository contains a complete [reusable workflow](https://docs.github.com/en/actions/using-workflows/reusing-workflows) that can be integrated into CI pipelines to perform a complete SetOps deployment via

```yaml
name: Deployment
on: push

jobs:
  setops-stages:
    name: Detect SetOps stages based on the current branch
    runs-on: ubuntu-latest
    outputs:
      stages: ${{ steps.stages.outputs.stages }}
    if: github.ref == 'refs/heads/production' || github.ref == 'refs/heads/staging'
    steps:
      - name: "Detect SetOps stages based on the current branch"
        id: stages
        run: |
          if [ "$GITHUB_REF" == "refs/heads/staging" ]; then
            echo '::set-output name=stages::staging'
          elif [ "$GITHUB_REF" == "refs/heads/production" ]; then
            echo '::set-output name=stages::production'
          else
            echo "⚠️ Could not determine stages for $GITHUB_REF"
            exit 1
          fi

  setops-deployment:
    uses: setopsco/github-actions/.github/workflows/build-and-deployment-workflow.yml@v2
    with:
      setops-organization: <yourorganization>
      setops-stages: ${{ needs.setops-stages.outputs.stages }}
      setops-apps: web worker
      setops-project: <projectname>
      predeploy-command: bin/rails db:migrate
      build-args: |
        COMMIT_SHA=${{ github.sha }}
        ANOTHER_BUILD_ARG="Another build arg required by your Dockerfile"
    secrets:
      setops-username: ${{ secrets.SETOPS_USER }}
      setops-password: ${{ secrets.SETOPS_PASSWORD }}
      build-secrets: |
        A_BUILD_SECRET_REQUIRED_BY_YOUR_DOCKERFILE="${{ secrets.SECRET1 }}"
        ANOTHER_BUILD_SECRET="A plain string works, too - but this is not secret anymore :-)"
```

This workflow

* Builds a docker image based on the `Dockerfile` in the project's root folder and pushes it to the SetOps registry.
* Deploys the image to every app configured in `setops-apps`. If you configure more than one stage in `setops-stages`, the workflow will deploy each stage in parallel.

CAUTION: The script assumes a configured [Container Health Check](https://docs.setops.co/latest/user/configuration/apps/#container-health-check) for *all* apps.

See the [workflow file](.github/workflows/build-and-deployment-workflow.yml) for all possible inputs.

## Building blocks

The workflow consists of a small workflow file that calls two separate Github Actions, which can also be included separately in your Github Workflow.

### Action: `setup`

<p align="left">
  <a href="https://github.com/setopsco/github-actions/actions"><img alt="Test Setup Action Build" src="https://github.com/setopsco/github-actions/workflows/test-setup-action-build/badge.svg" /></a>
  <a href="https://github.com/setopsco/github-actions/actions"><img alt="Test Setup Action" src="https://github.com/setopsco/github-actions/workflows/test-setup-action/badge.svg" /></a>
</p>

The `setopsco/github-actions/setup` action is a JavaScript action that sets up SetOps CLI in your GitHub Actions workflow by downloading a specific version of SetOps CLI and adding it to your `PATH`. The action also allows to login, which includes preparing the Docker Daemon to be able to push to SetOps.

After using the action, subsequent steps in the same job can run arbitrary SetOps commands using [the GitHub Actions `run` syntax](https://help.github.com/en/actions/reference/workflow-syntax-for-github-actions#jobsjob_idstepsrun). This allows most SetOps commands to work exactly as they do on your local command line.

This action can be run on `ubuntu-latest` GitHub Actions runners.

The default configuration installs the latest version of SetOps CLI and a wrapper script to wrap subsequent calls to the `setops` binary.

```yaml
steps:
- uses: setopsco/github-actions/setup@v2
```

A specific version of SetOps CLI can be installed:

```yaml
steps:
- uses: setopsco/github-actions/setup@v2
  with:
    setops_version: 1.0.0
```

Credentials for SetOps can be configured:

```yaml
steps:
- uses: setopsco/github-actions/setup@v2
  with:
    setops_organization: <yourorganization>
    setops_username: my-ci-user@setops.co
    setops_password: ${{ secrets.SETOPS_PASSWORD }}
```

See the [action file](setup/action.yml) for all possible inputs.

### Action: `build-and-push-image`

The action builds the image and pushes it to the SetOps registry with all needed tags (one for each stage/app - combination). It also tries to provide a Docker cache. The cache key contains the current date. This way, subsequent deploys within one day become faster while always using the newest (security) updates for the distros and packages.

You can also use the action without the workflow:

```yaml
jobs:
  build:
    name: Build and push image
    runs-on: ubuntu-latest
    outputs:
      image-digest: ${{ steps.build_and_push_image.outputs.image-digest }}
    steps:
      - name: "Checkout repository"
        uses: actions/checkout@v3
      - name: "Build image and push it to SetOps image registry"
        id: build_and_push_image
        uses: setopsco/github-actions/build-and-push-image@v2
        with:
          setops-organization: <yourorganization>
          setops-username: ${{ secrets.SETOPS_USER }}
          setops-password: ${{ secrets.SETOPS_PASSWORD }}
          setops-project: <projectname>
          setops-stages: ${{ needs.setops-stages.outputs.stages }}
          setops-apps: web worker
```

See the [action file](setops-build-and-push-image/action.yml) for all possible inputs.

### Action: `deployment`

The action

* Creates releases for all configured apps
* Runs the pre-deploy command within the first of the configured apps (`web` here)
* Activates all releases
* Waits until all releases are healthy

You can also use the action without the workflow:

```yaml
 deploy:
    name: Setops Deployment
    strategy:
      fail-fast: false
    concurrency: setops-deployment-${{ github.ref }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: "Checkout repository"
        uses: actions/checkout@v3
      - name: "Deploy project on SetOps"
        id: deploy
        uses: setopsco/github-actions/deployment@v2
        with:
          setops-organization: <yourorganization>
          setops-username: ${{ secrets.SETOPS_USER }}
          setops-password: ${{ secrets.SETOPS_PASSWORD }}
          setops-project: <projectname>
          setops-stage: <stagename>
          setops-apps: web worker
          image-digest: <sha256:7df5b97245.....>
          predeploy-command: bin/rails db:migrate
```

See the [action file](setops-deployment/action.yml) for all possible inputs.
