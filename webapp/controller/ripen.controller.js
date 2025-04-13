sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter"
], function (Controller, JSONModel, Filter) {
    "use strict";

    return Controller.extend("syncroad.ripening.controller.ripen", {

        onInit: async function () {
            await this.onCurrweather(); // 날씨 API 호출
        
            const oModel = this.getView().getModel();
            const aPlants = [];
            const plantSet = new Set();
        
            oModel.read("/RipStorage", {
                success: (oData) => {
                    oData.results.forEach((data) => {
                        if (!plantSet.has(data.Werks)) {
                            plantSet.add(data.Werks);
        
                            let label = "";
                            switch (data.Werks) {
                                case "P1000": label = "서울 숙성창고"; break;
                                case "P2000": label = "부산 숙성창고"; break;
                                default: label = data.Werks;
                            }
        
                            aPlants.push({ key: data.Werks, text: label });
                        }
                    });
        
                    this.getView().setModel(new JSONModel(aPlants), "werksModel");
                    this.getView().setModel(new JSONModel(), "resultModel");
                    this.getView().setModel(new JSONModel({ selectedWerks: "" }), "viewModel");
        
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
                    console.error("실패:", oError);
                }
            });
        },
        //open api날씨 영역
        onCurrweather: async function (sWerks) {

            const locationMap = {
                "P1000": { lat: 37.5665, lon: 126.9780, name: "서울 숙성창고" },
                "P2000": { lat: 35.1796, lon: 129.0756, name: "부산 숙성창고" }
            };
        
            const location = locationMap[sWerks] || locationMap["P1000"]; //렌더링 시 기본 plant
        
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
        //plant 별 렌더링
        onPlantChange: function (oEvent) {
            const sWerks = oEvent.getSource().getSelectedKey();
            const oModel = this.getView().getModel();
        
            // 필터 조건 생성
            const aFilter = [new sap.ui.model.Filter("Werks", "EQ", sWerks)];
        
            oModel.read("/RipStorage", {
                filters: aFilter,
                success: (oData) => {
                    if (oData.results && oData.results.length > 0) {
                        const oSelected = oData.results[0];
        
                        this.getView().getModel("resultModel").setData(oSelected)

                        this.onCurrweather(sWerks);
                    }
                }
            });
        },

        onComboChange: function (oEvent) {
            const sInputValue = oEvent.getSource().getValue(); // 사용자 입력값
            const aPlantList = this.getView().getModel("werksModel").getData();
            const bExists = aPlantList.some(plant => plant.key === sInputValue);
        
            if (bExists) {
                this.getView().getModel("viewModel").setProperty("/selectedWerks", sInputValue);
        
                // ComboBox 선택 이벤트 강제 트리거
                this.onPlantChange({
                    getSource: () => ({
                        getSelectedKey: () => sInputValue
                    })
                });
            }
        },
        
        // 숙성창고 데이터
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

            this.onWaring(oData.Tempe, oData.Humid);
        },
        //수정필요
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
        }
     
    });
});
