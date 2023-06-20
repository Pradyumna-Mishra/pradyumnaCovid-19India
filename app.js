const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "pratech", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        console.log("API-1");
        next();
      }
    });
  }
};

const changeDistrictColumnName = (data) => {
  return {
    districtId: data.district_id,
    districtName: data.district_name,
    stateId: data.state_id,
    cases: data.cases,
    cured: data.cured,
    active: data.active,
    deaths: data.deaths,
  };
};

//GET STATES API
app.get("/states/", authenticateToken, async (request, response) => {
  console.log("API-2");
  const getStatesQuery = `SELECT state_id AS stateId, state_name AS stateName, population FROM state;`;
  const states = await db.all(getStatesQuery);
  response.send(states);
});

//GET STATE API
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  console.log("API-3");
  const { stateId } = request.params;
  const getStateQuery = `SELECT state_id AS stateId, state_name AS stateName, population FROM state WHERE state_id = ${stateId};`;
  const state = await db.get(getStateQuery);
  response.send(state);
});

//POST DISTRICT API
app.post("/districts/", authenticateToken, async (request, response) => {
  console.log("API-4");
  const districtsData = request.body;
  const { districtName, stateId, cases, cured, active, deaths } = districtsData;
  const postDistrictsQuery = `INSERT INTO district (district_name, state_id, cases, cured, active, deaths) VALUES ('${districtName}',${stateId}, ${cases}, ${cured},${active},${deaths});`;
  await db.run(postDistrictsQuery);
  response.send("District Successfully Added");
});

//GET DISTRICT API
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    console.log("API-5");
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * From district WHERE district_id = ${districtId};`;
    const district = await db.get(getDistrictQuery);
    response.send(changeDistrictColumnName(district));
  }
);

//DELETE DISTRICT API
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    console.log("API-6");

    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE  FROM district WHERE district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// UPDATE DISTRICT API
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    console.log("API-7");
    const { districtId } = request.params;
    const updateData = request.body;
    const { districtName, stateId, cases, cured, active, deaths } = updateData;
    const updateDistrictQuery = `UPDATE district SET district_name = '${districtName}', 
     state_id = ${stateId}, cases = ${cases}, cured = ${cured}, active= ${active}, deaths = ${deaths};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    console.log("API-8");
    const { stateId } = request.params;
    const total = `SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured, SUM(active) AS totalActive, SUM(deaths) AS totalDeaths FROM district GROUP BY state_id = ${stateId};`;
    const data = await db.get(total);
    response.send(data);
  }
);

//USER LOGIN
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "pratech");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

module.exports = app;
