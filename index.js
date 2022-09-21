const request = require("request");
const notifier = require("node-notifier");
const flatMap = require('array.prototype.flatmap');
const replaceAll = require("string.prototype.replaceall");
const nodemailer = require('nodemailer');

flatMap.shim();
replaceAll.shim();

const { COUNTRIES } = require("./constants");
const args = process.argv.slice(2);

let skusForCountry = (countrySkuCode) => {
  return {
    //[`MKGR3LL/A`]: `14" M1 Pro 8 Core CPU 14 Core GPU 512GB Silver`,
    //[`MKGP3LL/A`]: '14" M1 Pro 8 Core CPU 14 Core GPU 512GB Space Grey',
    //[`MKGT3LL/A`]: '14" M1 Pro 10 Core CPU 16 Core GPU 1TB Silver',
    [`MQ993VC/A`]: 'IPhone 14 Pro Max 128GB Deep Purple',
    [`MQ9E3VC/A`]: 'IPhone 14 Pro Max 256GB Deep Purple',
    [`MQ9J3VC/A`]: 'IPhone 14 Pro Max 512GB Deep Purple',
    [`MQ9N3VC/A`]: 'IPhone 14 Pro Max 1TB Deep Purple',
    [`MQ983VC/A`]: 'IPhone 14 Pro Max 128GB Gold',
    [`MQ9D3VC/A`]: 'IPhone 14 Pro Max 256GB Gold',
    [`MQ9H3VC/A`]: 'IPhone 14 Pro Max 512GB Gold',
    [`MQ9M3VC/A`]: 'IPhone 14 Pro Max 1TB Gold',
    [`MQ973VC/A`]: 'IPhone 14 Pro Max 128GB Silver',
    [`MQ9C3VC/A`]: 'IPhone 14 Pro Max 256GB Silver',
    [`MQ9G3VC/A`]: 'IPhone 14 Pro Max 512GB Silver',
    [`MQ9L3VC/A`]: 'IPhone 14 Pro Max 1TB Silver',
    [`MQ963VC/A`]: 'IPhone 14 Pro Max 128GB Space Black',
    [`MQ9A3VC/A`]: 'IPhone 14 Pro Max 256GB Space Black',
    [`MQ9F3VC/A`]: 'IPhone 14 Pro Max 512GB Space Black',
    [`MQ9K3VC/A`]: 'IPhone 14 Pro Max 1TB Space Black',
  }
}

let favouritesForCountry = (countrySkuCode) => {
  return [
    `MQ983VC/A`,
    `MQ9D3VC/A`,
    `MQ9H3VC/A`,
  ]
}

const control = "MYD92LL/A";
let storeNumber = "R488";
let state = "BC";
let country = "CA"

if (args.length > 0) {
  const passedStore = args[0];
  country = (args[1] ? args[1] : "CA").toUpperCase();
  if (passedStore.charAt(0) === "R") {
    // All retail store numbers start with R
    storeNumber = passedStore;
    state = null;
  }
}

const countryConfig = COUNTRIES[country];

let storePath = countryConfig["storePath"];
let skuList = skusForCountry(countryConfig["skuCode"]);
let favorites = favouritesForCountry(countryConfig["skuCode"]);

const query =
  Object.keys(skuList)
    .map((k, i) => `parts.${i}=${encodeURIComponent(k)}`)
    .join("&") + `&searchNearby=true&store=${storeNumber}`;

//console.log(query)

let options = {
  method: "GET",
  url: `https://www.apple.com${storePath}/shop/fulfillment-messages?` + query,
};

var mailtransport = nodemailer.createTransport({
    service: "hotmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

request(options, function (error, response) {
  if (error) throw new Error(error);

  const body = JSON.parse(response.body);
  const storesArray = body.body.content.pickupMessage.stores;
  let skuCounter = {};
  let hasStoreSearchError = false;

  console.log('Inventory');
  console.log('---------');
  const statusArray = storesArray
    .flatMap((store) => {
      if (state && state !== store.state) return null;
      //console.log(store)

      const name = store.storeName;
      let productStatus = [];

      for (const [key, value] of Object.entries(skuList)) {
        const product = store.partsAvailability[key];
        //console.log(product)

        hasStoreSearchError = product.storeSearchEnabled !== true;

        if (key === control && hasStoreSearchError !== true) {
          hasStoreSearchError = product.pickupDisplay !== "available";
        } else {
          productStatus.push(`${value}: ${product.pickupDisplay}`);

          if (product.pickupDisplay === "available") {
            console.log(`${value} in stock at ${store.storeName}`);
            let count = skuCounter[key] ? skuCounter[key] : 0;
            count += 1;
            skuCounter[key] = count;
          }
        }
      }

      return {
        name: name,
        products: productStatus,
      };
    })
    .filter((n) => n);

  let hasError = hasStoreSearchError;

  const inventory = Object.entries(skuCounter)
    .map(([key, value]) => `${skuList[key]}: ${value}`)
    .join(" | ");

  console.log('\nInventory counts');
  console.log('----------------');
  console.log(inventory.replaceAll(" | ", "\n"));
  let hasUltimate = Object.keys(skuCounter).some(
    (r) => favorites.indexOf(r) >= 0
  );
  let notificationMessage;

  if (inventory) {
    notificationMessage = `${hasUltimate ? "FOUND ULTIMATE! " : ""
      }Some models found: ${inventory}`;

    // First an email...
    var mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_TARGET_USER,
      subject: 'Iphone models found',
      text: notificationMessage
    };

    mailtransport.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });

    // We have to wait a sec
    setTimeout(() => {

      var mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.SMS_TARGET_USER,
        subject: 'Iphone models found',
        text: notificationMessage
      };
    
      // Then, a text message
      mailtransport.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });

    }, 1000);

  } 
  else {
    notificationMessage = "No models found.";
    console.log(statusArray);
    console.log(notificationMessage);

    dt = new Date()
    minutes = dt.getMinutes()
    // Once an hour
    if (minutes < 9) {

      statusArrayStr = JSON.stringify(statusArray, null, 2)
      email = `${statusArrayStr}\n${notificationMessage}`
      console.log(email)
      var mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TARGET_USER,
        subject: 'Iphone models not found',
        text: email
      };

      mailtransport.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });
    }

  }

  const message = hasError ? "Possible error?" : notificationMessage;
  notifier.notify({
    title: "MacBook Pro Availability",
    message: message,
    sound: hasError || inventory,
    timeout: false,
  });

  // Log time at end
  console.log(`\nGenerated: ${new Date().toLocaleString()}`);
});
