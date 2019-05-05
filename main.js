const netlify = require("netlify");
const util = require("util");
const fetch = require("node-fetch");
const fs = require("fs");
const fx = require("mkdir-recursive");
const path = require('path');


const config = require("./config");

const views = {
	index: function(data) {
		return require("./views/index")(data)
	},
	error: function(data) {
		return require("./views/error")(data)
	},
	noFood: function(data) {
		return require("./views/noFood")(data)
	},
};


function main() {
	return getData()
		.then(generateHtml)
		.then(writeHtmlToDisk)
		.then(uploadToNetlify)
}

// AWS-Lambda-compliant handler
exports.handler = (event, context, callback) => {
	main()
		.then(_ => callback(null, "Successfully deployed new site."))
		.catch(error => callback(error))
}

// Handler for local execution
exports.run = () => {
	exports.handler(null, null, (error, response) => {
		if (error !== null) console.error(error);
		if (typeof response !== "undefined") console.log(response);
	});
}

function getData() {
	const date = new Date().toISOString().slice(0, 10);
	const url = util.format(config.openmensa_url, date);
	return fetch(url);
}

function generateHtml(response) {
	switch (response.status) {
		case 404:
			return Promise.resolve(views.noFood());
		case 200:
			return response.json().then(data => views.index(data));
		default:
			return response
				.text()
				.then(text => views.error(text))
				.catch(bodyError => views.error(JSON.stringify(bodyError)));
	}
}

function writeHtmlToDisk(html) {
	return new Promise((resolve, reject) => {
		try {
			fx.mkdirSync(config.tmpdir);
		} catch (err) {
			if (err.code !== "EEXIST") {
				reject("Error creating temporary directory.");
				return;
			}
		}

		const filepath = path.join(config.tmpdir, "index.html")

		fs.writeFile(filepath, html, function(err) {
			if (err) {
				reject(err);
			} else {
				resolve(config.tmpdir);
			}
		});
	});
}

function uploadToNetlify(path) {
	const client = netlify.createClient({
		access_token: config.netlify.access_token
	});

	return client
		.site(config.netlify.site)
		.then(site =>
			site.createDeploy({
				dir: path
			})
		)
		//.then(deploy => deploy.waitForReady());
}
