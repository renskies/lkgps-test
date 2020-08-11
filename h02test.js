const dotenv = require('dotenv');
const net = require('net');
const colors = require('colors');

// Load env vars
dotenv.config({ path: './config/config.env' });

const PORT = process.env.PORT || 5001;

// device data
var specs = [
  function (raw) {
    // 1203292316,0031698765432,GPRMC,211657.000,A,5213.0247,N,00516.7757,E,0.00,273.30,290312,,,A*62,F,imei:123456789012345,123
    // *HQ,4209950057,V1,035522,A,1321.1457,N,10351.0798,E,000.00,000,240317,BFFFFBFF,456,06,0,0,6#
    // *HQ,4209950057,#
    // *HQ,4209950057,V19,035522,A,1321.1457,N,10351.0798,E,000.00,000,240317,,,8985506081694161822F,BFFFFBFF#
    var result = null;
    var str = [];
    var datetime = '';
    var gpsdate = '';
    var gpstime = '';

    try {
      raw = raw.trim();
      str = raw.split(',');

      if (str.length === 18 && str[2] === 'V1') {
        datetime = str[11].replace(
          /([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})/,
          function (s, y, m, d, h, i) {
            return '20' + y + '-' + m + '-' + d + ' ' + h + ':' + i;
          }
        );

        gpsdate = str[11].replace(/([0-9]{2})([0-9]{2})([0-9]{2})/, function (
          s,
          d,
          m,
          y
        ) {
          return '20' + y + '-' + m + '-' + d;
        });

        gpstime = str[3].replace(/([0-9]{2})([0-9]{2})([0-9]{2})/, function (
          s0,
          h,
          i,
          s
        ) {
          return h + ':' + i + ':' + s;
        });

        allMasks = getBitMasks(str[12]);

        result = {
          raw: raw,
          datetime: datetime,
          phone: str[1],
          gps: {
            date: gpsdate,
            time: gpstime,
            //signal: str [15] === 'F' ? 'full' : 'low', // from binary TODO
            fix: str[4] === 'A' ? 'active' : 'invalid',
            batt: str[14],
          },
          geo: {
            latitude: fixGeo(str[5], str[6]),
            longitude: fixGeo(str[7], str[8]),
            bearing: parseInt(str[10], 10),
          },
          speed: {
            knots: Math.round(str[9] * 1000) / 1000,
            kmh: Math.round(str[10] * 1.852 * 1000) / 1000,
            mph: Math.round(str[10] * 1.151 * 1000) / 1000,
          },
          status: {
            retention: { power_cut: false },
            gps: {
              vibration: false,
              power_cut: false,
              shock: false,
              low_battery: allMasks[1][7],
            },
            vehicle: { armed: false, ac: false },
            alarm: {
              sos: false,
              speed: false,
              drop: allMasks[3][1] === false ? true : false,
            },
          },
          // rawBitMasks: allMasks,
          imei: str[1],
          //checksum: h02.checksum (raw) // TODO No checksum info
        };
      }
    } catch (e) {
      result = e;
    }

    return result;
  },
];

// Catch uncaught exceptions (server kill)
process.on('uncaughtException', function (err) {
  var error = new Error('uncaught exception');

  error.error = err;
  console.log(error);
});

const server = net.createServer((client) => {
  // 'connection' listener.
  console.log('client connected');

  client.setEncoding('utf8');
  client.on('data', (data) => {
    let gps = {};

    data = data.trim();

    if (data !== '') {
      gps = parse(data);

      if (gps) {
        console.log(gps);
      }
    }
  });
});

// Parse GPRMC string
const parse = function (raw) {
  var data = null;
  var i = 0;

  while (data === null && i < specs.length) {
    data = specs[i](raw);
    i++;
  }

  return data;
};

// Clean geo positions, with 6 decimals
const fixGeo = function (one, two) {
  var minutes = one.substr(-7, 7);
  var degrees = parseInt(one.replace(minutes, ''), 10);

  one = degrees + minutes / 60;
  one = parseFloat((two === 'S' || two === 'W' ? '-' : '') + one);
  return Math.round(one * 1000000) / 1000000;
};

const getBitMasks = function (hex) {
  (theByte = 0), (theBitMask = {}), (theBitMaskArray = []);
  for (var i = hex.length; i > 0; i -= 2) {
    var v = parseInt(hex.substr(i - 2, 2), 16);
    theBitMaskArray = v.toString(2).split('');
    theBitMask[theByte] = {};
    for (var j = 0; j < theBitMaskArray.length; j++) {
      if (theBitMaskArray[j] === '0') {
        // non sense but 0 means positive (see h02 doc)
        theBitMask[theByte][j] = true;
      } else {
        theBitMask[theByte][j] = false;
      }
    }
    theByte++;
  }
  return theBitMask;
};

// Check checksum in raw string
const checksum = function (raw) {
  var str = raw.trim().split(/[,*#]/);
  var strsum = parseInt(str[15], 10);
  var strchk = str.slice(2, 15).join(',');
  var check = 0;
  var i;

  for (i = 0; i < strchk.length; i++) {
    check ^= strchk.charCodeAt(i);
  }

  check = parseInt(check.toString(16), 10);
  return check === strsum;
};

server.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold
  );
});
