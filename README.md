# Github Actions for SetOps

## Deployment Workflow

The repository contains a complete [reusable workflow](https://docs.github.com/en/actions/using-workflows/reusing-workflows) that can be integrated in CI pipelines to perform a complete SetOps deployment via

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
    uses: setopsco/github-actions/.github/workflows/build-and-deployment-workflow.yml@v1
    with:
      setops-stages: ${{ needs.setops-stages.outputs.stages }}
      setops-apps: '["web", "clock", "worker"]'
      setops-project: my_setops_project_name
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

You can deploy from one branch to multiple setops stages by setting the output in the `setops_stages` job to a space separated list of stages like this:
```
   echo '::set-output name=stages::production demo'
```


This workflow

* Builds a docker image based on the `Dockerfile` in the project's root folder and pushes it to the SetOps registry
* Deploys the image to every app configured in `setops-apps`. If you configure more than one stage in `setops-stages`, the workflow will deploy each stage in parallel

CAUTION: The script assumes a configured healthcheck for *all* apps.

See the [workflow file](.github/workflows/build-and-deployment-workflow.yml) for all possible inputs

## Building blocks

The workflow consists of a small workflow file that calls two separate Github Actions which can also be included separately your Github Workflow.

### Action: `build-and-push-image`

The action builds the image and pushes it to the SetOps registry with all needed tags (one for each stage / app - combination). It also tries to provide a Docker cache. The cache key contains the current date. This way, subsequent deploys within one day become faster while always using the newest (security) updates for the distros and packages.

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
        uses: actions/checkout@v2
      - name: "Build image and push it to SetOps image registry"
        id: build_and_push_image
        uses: setopsco/github-actions/build-and-push-image@v1
        with:
          setops-stages: ${{ needs.setops-stages.outputs.stages }}
          setops-apps: '["web", "clock", "worker"]'
          setops-username: ${{ secrets.SETOPS_USER }}
          setops-password: ${{ secrets.SETOPS_PASSWORD }}
          setops-project: my_setops_project_name
```

See the [action file](setops-build-and-push-image/action.yml) for all possible inputs

### Action: `deployment`

The action

* Creates releases for all configured apps
* Runs the predeploy command within the first of the configured apps
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
        uses: actions/checkout@v2
      - name: "Deploy project on SetOps"
        id: deploy
        uses: setopsco/github-actions/deployment@v1
        with:
          setops-stage: production
          setops-apps: ${{ inputs.apps }}
          setops-project: my_setops_project_name
          setops-username: ${{ secrets.SETOPS_USER }}
          setops-password: ${{ secrets.SETOPS_PASSWORD }}
          image-digest: ${{ needs.build.outputs.image-digest }}
          predeploy-command: bin/rails db:migrate
```

See the [action file](setops-deployment/action.yml) for all possible inputs
