sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter"
], function (Controller, JSONModel, Filter) {
    "use strict";

    return Controller.extend("syncroad.ripening.controller.ripen", {

        onInit: async function () {
            await this.onCurrweather();

            const oModel = this.getView().getModel();
            const aPlants = [];
            const plantSet = new Set();

            oModel.read("/RipStorage", {
                success: (oData) => {
                    const aCleaned = this._cleanRipeningData(oData.results);
                    // const aSorted = [...aCleaned].sort((a, b) => new Date(a.Datbi) - new Date(b.Datbi));

                    aCleaned.forEach((data) => {
                        if (!plantSet.has(data.Werks)) {
                            plantSet.add(data.Werks);

                            //plant 번호 대신 지역 이름으로 설정정
                            let label = "";
                            switch (data.Werks) {
                                case "P1000": label = "경기 숙성창고"; break;
                                case "P2000": label = "충청 숙성창고"; break;
                                case "P3000": label = "전라 숙성창고"; break;
                                default: label = data.Werks;
                            }

                            aPlants.push({ key: data.Werks, text: label });
                        }
                    });

                    this.getView().setModel(new JSONModel(aPlants), "werksModel");
                    this.getView().setModel(new JSONModel(), "resultModel");
                    this.getView().setModel(new JSONModel({ selectedWerks: "" }), "viewModel");
                    this.getView().setModel(new JSONModel(aCleaned), "ripeningModel"); // 차트용 모델

                    if (aPlants.length > 0) {
                        const sDefault = aPlants[0].key;
                        this.getView().getModel("viewModel").setProperty("/selectedWerks", sDefault);

                        this.onPlantChange({
                            getSource: () => ({
                                getSelectedKey: () => sDefault
                            })
                        });
                    }
                },
                error: (oError) => {
                    console.error("초기 데이터 호출 실패:", oError);
                }
            });
        },
        //open wether API 받아옴
        onCurrweather: async function (sWerks) {
            const locationMap = {
                "P1000": { lat: 37.5665, lon: 126.9780, name: "경기 숙성창고" },
                "P2000": { lat: 35.1796, lon: 129.0756, name: "충청 숙성창고" },
                "P3000": { lat: 33.1796, lon: 115.0756, name: "전라 숙성창고" }
            };

            const location = locationMap[sWerks] || locationMap["P3000"];

            try {
                const url = `https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lon}&units=metric&lang=kr&appid=613ac7d721406d59cec6506314044e4a`;
                const response = await fetch(url);
                const data = await response.json();

                const tempMax = Math.round(data.main.temp_max);
                const tempMin = Math.round(data.main.temp_min);
                const currentTemp = Math.round(data.main.temp);
                const humidity = Math.round(data.main.humidity);

                this.byId("txtTempMax").setText(`${tempMax}°C`);
                this.byId("txtTempMin").setText(`${tempMin}°C`);
                this.byId("txtTempCurr").setText(`${currentTemp}°C`);
                this.byId("txtHumidity").setText(`${humidity}%`);

            } catch (error) {
                console.error("날씨 호출 실패:", error);
            }
        },
        //Werks를 기준으로 plant 렌더링 다르게게
        onPlantChange: function (oEvent) {
            const sWerks = oEvent.getSource().getSelectedKey();
            const oModel = this.getView().getModel();
            const aFilter = [new Filter("Werks", "EQ", sWerks)];

            oModel.read("/RipStorage", {
                filters: aFilter,
                success: (oData) => {
                    if (oData.results && oData.results.length > 0) {
                        const [oSelected] = this._cleanRipeningData(oData.results);
                        this.getView().getModel("resultModel").setData(oSelected);
                        this.onCurrweather(sWerks);
                    }
                },
                error: (err) => {
                    console.error("플랜트 데이터 호출 실패:", err);
                }
            });
        },
        //list box로 plant 선택 시 정보들 변환환
        onComboChange: function (oEvent) {
            const sInputValue = oEvent.getSource().getValue();
            const aPlantList = this.getView().getModel("werksModel").getData();
            const bExists = aPlantList.some(plant => plant.key === sInputValue);

            if (bExists) {
                this.getView().getModel("viewModel").setProperty("/selectedWerks", sInputValue);

                this.onPlantChange({
                    getSource: () => ({
                        getSelectedKey: () => sInputValue
                    })
                });
            }
        },
        //숙성창고 테이블 데이터터
        onStorage: function () {
            const oModel = this.getView().getModel(),
                oTable = this.getView().byId('DocuTable'),
                aIndex = oTable.getSelectedIndices(),
                oContext = oTable.getContextByIndex(aIndex[0]),
                oData = oContext.getObject();

            this.byId('Stlno').setValue(oData.Stlno);
            this.byId('Stltype').setValue(oData.Stltype);
            this.byId('Werks').setValue(oData.Werks);
            this.byId('Matnr').setValue(oData.Matnr);
            this.byId('Tempe').setValue(oData.Tempe);
            this.byId('Humid').setValue(oData.Humid);
            this.byId('Dpose').setValue(oData.Dpose);
            this.byId('Batno').setValue(oData.Batno);
            this.byId('Datbi').setValue(oData.Datbi);
            this.byId('Temptime').setValue(oData.Temptime);

            this.onWaring(oData.Tempe, oData.Humid);
        },
        //주의요망 부분인데 수정 필요
        onWaring: function (currentTemp, humidity) {
            const oText = this.byId("WarningText");
            if (currentTemp >= 5 || humidity >= 90) {
                oText.setText("주의요망!");
                oText.removeStyleClass("safeText");
                oText.addStyleClass("dangerText");
            } else {
                oText.setText("숙성중");
                oText.removeStyleClass("dangerText");
                oText.addStyleClass("safeText");
            }
        },
        // 날짜, 시간 타입 변경
        _cleanRipeningData: function (aData) {
            return aData.map(item => {
                item.Dpose = Number(item.Dpose || 0);
                item.Tempe = Number(item.Tempe || 0);
        
                // 날짜 문자열로 변환환
                if (item.Datbi) {
                    const date = new Date(item.Datbi);
                    const yyyy = date.getFullYear();
                    const mm = String(date.getMonth() + 1).padStart(2, '0');
                    const dd = String(date.getDate()).padStart(2, '0');
                    item.Datbi = `${yyyy}-${mm}-${dd}`;
                }
        
                // 시간 문자열로 변경
                if (typeof item.Temptime === "object" && item.Temptime.ms) {
                    const dateObj = new Date(item.Temptime.ms);
                    const hours = String(dateObj.getHours()).padStart(2, '0');
                    const mins = String(dateObj.getMinutes()).padStart(2, '0');
                    item.Temptime = `${hours}:${mins}`;
                } else if (typeof item.Temptime === "string" && item.Temptime.length === 6) {
                    const hours = item.Temptime.substring(0, 2);
                    const mins = item.Temptime.substring(2, 4);
                    item.Temptime = `${hours}:${mins}`;
                }
        
                return item;
            });
        }
        
        //Datbi 오름차순 정렬
        // onAfterRendering: function () {
        //     var oVizFrame = this.byId("idLineFrame");
        //     var oDataset = oVizFrame.getDataset();
        //     var oBinding = oDataset.getBinding("data");
        
        //     oBinding.sort(new sap.ui.model.Sorter("Datbi", false)); // 오름차순 정렬
        // }

    });
});
