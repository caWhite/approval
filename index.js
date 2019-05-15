var axios = require("axios");
var yargs = require("yargs");

var args = yargs.options({
  p: {
    alias: "project",
    demandOption: true
  },
  o: {
    alias: "organization",
    default: "media-msa"
  },
  name: {
    alias: "release-name",
    demandOption: true
  },
  env: {
    alias: "release-environment",
    demandOption: true
  },
  "pat-token": {
    describe: "Personal access token"
  },
  "access-token": {
    describe: "OAuth2 access token"
  }
}).argv;

if (!args.patToken && !args.accessToken) {
  console.error("One of either PAT or OAuth2 token must be supplied");
  process.exit(1);
}

let organization = args.organization;
let project = args.project;
let releaseDefinition = args.name;
let releaseEnvironment = args.env;

let getApprovalUrl = `https://vsrm.dev.azure.com/${organization}/${project}/_apis/release/approvals`;

let requestConfig = {
  params: {
    "api-version": "5.0"
  }
};

let baseConfig = {};
if (args.accessToken) {
  baseConfig.headers = {
    Authorization: `Bearer: ${args.accessToken}`
  };
} else {
  baseConfig.auth = {
    username: args.patToken
  };
}

var getApprovalPromise = axios
  .get(getApprovalUrl, Object.assign(baseConfig, requestConfig))
  .then(response => {
    let approval = response.data.value.find(item => {
      return (
        item.releaseDefinition.name == releaseDefinition &&
        item.releaseEnvironment.name == releaseEnvironment
      );
    });
    if (approval) return approval;
    else return Promise.reject({ message: "No release to approve!" });
  });

getApprovalPromise.catch(error => {
  if (error.message) {
    console.log(error.message);
    process.exit(0);
  } else {
    console.error(error);
    process.exit(1);
  }
});

getApprovalPromise
  .then(approval => {
    let Id = approval.id;
    let putApprovalUrl = `https://vsrm.dev.azure.com/${organization}/${project}/_apis/release/approvals/${Id}`;

    console.log(`Pending approval # ${Id}`);

    let data = {
      status: "approved",
      isAutomated: true,
      comments: "Automated approval from 'Azure DevOps Build Service' account"
    };

    let config = {
      params: {
        "api-version": "5.0"
      }
    };

    return axios.patch(putApprovalUrl, data, Object.assign(baseConfig, config));
  })
  .then(response => {
    console.log(response);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
