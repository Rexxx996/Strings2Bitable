import $ from 'jquery';
import { IField, FieldType, ITable, bitable } from '@lark-base-open/js-sdk';
import './index.scss';
import './locales/i18n'; // 开启国际化，详情请看README.md

function showLoadingOverlay() {
  const loadingStatus = document.getElementById('loadingStatus');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadEndOverlay = document.getElementById('loadEndOverlay');

  if (loadingStatus) {
    loadingStatus.innerText = '';
  }

  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
  }

  if (loadEndOverlay) {
    loadEndOverlay.style.display = 'none';
  }
}

function hideOverlay() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadEndOverlay = document.getElementById('loadEndOverlay');

  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }

  if (loadEndOverlay) {
    loadEndOverlay.style.display = 'none';
  }
}

function updateLoadingProgress(statusText: string, current: number, total: number) {
  const progressText = statusText + `${current}/${total}`;

  const loadingStatus = document.getElementById('loadingStatus');
  if (loadingStatus) {
    loadingStatus.innerText = `${progressText}`;
  }
}

// function updateAnalyzeProgress(statusText: string, current: number, total: number) {
//   const progressText = statusText + `${current}/${total}`;

//   const loadingStatus = document.getElementById('loadingStatus');
//   if (loadingStatus) {
//     loadingStatus.innerText = `${progressText}`;
//   }
// }

function showConfirmation(statusText: string, current: number, total: number) {
  const progressText = statusText + `${current}/${total}`;
  const loadEndStatus = document.getElementById('loadEndStatus');
  if (loadEndStatus) {
    loadEndStatus.innerText = `${progressText}`;
  }
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }

  const loadEndOverlay = document.getElementById('loadEndOverlay');
  if (loadEndOverlay) {
    loadEndOverlay.style.display = 'flex';
  }

  const btnConfirm = document.getElementById('btnConfirm');
  if (btnConfirm) {
    btnConfirm.focus();
  }
}

function getFileExtension(filename: string) {
  return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 1);
}

$('#btnConfirm').on('click', async function() {
  hideOverlay();
});

$(async function() {

  const KEY_FIELD_NAME = "key";

  // 监听选择文件
  const inputFile = document.getElementById('inputFile') as HTMLInputElement;
  const inputLang = document.getElementById('inputLang') as HTMLInputElement;
  const btnAnalyzeFile = document.getElementById('btnAnalyzeFile');


  inputFile?.addEventListener('change', updateButtonState);
  inputLang?.addEventListener('input', updateButtonState);

  function updateButtonState() {
    if (inputFile?.files && inputFile.files.length > 0 && inputLang?.value.trim() !== '') {
      btnAnalyzeFile?.removeAttribute('disabled');
    } else {
      btnAnalyzeFile?.setAttribute('disabled', 'true');
    }
  }

  // 解析文件
  $('#btnAnalyzeFile').on('click', async function() {
    // btnAnalyzeFile.addEventListener('click', async function() {

    // 显示加载图标
    showLoadingOverlay();

    console.time("解析文件时间");

    const file = inputFile?.files && inputFile.files[0];
    if (file) {

      console.log('Input File:', file.name);
      console.log('Input Language:', inputLang?.value)

      let fileTable: ITable | null = null;
      let langField: IField | null = null;
      let keyField: IField | null = null;
      let currProgress = 0;
      let totalProgress = 0;

      //创建数据表
      try {
        await bitable.base.addTable({
          name: file.name,
          fields: [
            {
              name: KEY_FIELD_NAME,
              type: FieldType.Text
            },
            {
              name: inputLang?.value,
              type: FieldType.Text,
            }
          ]
        })

      } catch (error) {
        console.log('Table is exist.');
      }

      //获取数据表
      fileTable = await bitable.base.getTableByName(file.name);

      console.log('Get table:', fileTable);

      //获取/创建Key字段
      try {

        await fileTable.addField({ name: KEY_FIELD_NAME, type: FieldType.Text });

      } catch (error) {
        console.log('Key field is exist.');
      }

      keyField = await fileTable.getField(KEY_FIELD_NAME);
      console.log('Get key field :', keyField);

      //获取/创建语言字段
      try {

        await fileTable.addField({ name: inputLang?.value, type: FieldType.Text });

      } catch (error) {

        console.log('Language field is exist.', inputLang?.value);
      }

      langField = await fileTable.getField(inputLang?.value);
      console.log('Get language field :', langField);

      // 创建一个Map对象(key, value, record id)来存储Record
      const recordMap = new Map<string, string>();
      const recordList = await fileTable.getRecordList();
      const recordIdList = await fileTable.getRecordIdList();
      console.log('Get record list:', recordList, recordIdList);

      currProgress = 0;
      totalProgress = recordIdList.length;
      updateLoadingProgress($.t('loading_table'), currProgress, totalProgress);

      for (const record of recordList) {
        // const keyCell = await record.getCellByField(keyField);
        // const keyVal = await keyCell.getValue();

        const keyVal = await fileTable.getCellString(keyField.id, record.id);

        currProgress++;
        updateLoadingProgress($.t('loading_table'), currProgress, totalProgress);

        // const langCell = await record.getCellByField(langField);
        // const langVal = await langCell.getValue();

        console.log("key Val:", keyVal);

        if (keyVal) {
          recordMap.set(keyVal, record.id);

          // console.log('get record:', keyVal[0].text, ' ', record.id);
        }

        // else
        // {
        //   // 删除空行
        //   await fileTable.deleteRecord(record);
        // }
      }

      // 替换实体字符<>&为的实体名称
      function convertToEntities(str: string) {
        return str.replace(/&/g, "&amp;") //
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        // .replace(/@/g, "&commat;");
      }

      const reader = new FileReader();

      reader.onload = async function(event) {
        const fileReader = event.target as FileReader;
        const fileContent = fileReader.result as string;
        let keyValuePairs = null;
        let key = null;
        let value = null;
        let isXmlType = false;
        let recordsToBeAdded = [];
        let recordsToBeUpdate = [];

        // console.log('fileContent', fileContent);

        const fileExtension = file.name.slice((file.name.lastIndexOf(".") - 1 >>> 0) + 1);
        console.log('fileExtension:', fileExtension);
        if (fileExtension === '.xml') {
          // 解析 XML 文件
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(fileContent, "application/xml");
          keyValuePairs = xmlDoc.getElementsByTagName("string");

          console.log('xmlDoc:', xmlDoc);
          // console.log('&lt;font color=#ff0000&gt;New Version %s&lt;/font&gt;');

          isXmlType = true;
        } else if (fileExtension === '.strings') {
          // 使用正则表达式提取"key"和"value"
          keyValuePairs = fileContent.match(/"([^"]+)"\s*=\s*"((?:\\"|[^"])*)"/g);

          isXmlType = false;
        }

        console.log('keyValuePairs:', keyValuePairs?.length);

        currProgress = 0;
        totalProgress = keyValuePairs?.length || 0;
        updateLoadingProgress($.t('analyze_to_table'), currProgress, totalProgress);

        if (keyValuePairs) {
          for (const pair of keyValuePairs) {

            if (isXmlType) {
              if (pair instanceof Element) {
                key = pair.getAttribute("name");
                value = pair.textContent;
                if (value) {
                  value = convertToEntities(value);
                  // console.log('strings:', value);
                }
              }
            } else {
              if (typeof pair === 'string') {
                const matches = pair.match(/"([^"]+)"\s*=\s*"((?:\\"|[^"])*)"/);
                if (matches) {
                  key = matches[1];
                  value = matches[2];
                }
              }
            }

            // currProgress++;
            // updateLoadingProgress($.t('analyze_to_table'), currProgress, totalProgress);
            if (key) {
              if (recordMap.has(key)) {
                // console.log('setCellValue:', langField.id, recordMap.get(key), value);

                // const res = await fileTable.setCellValue(langField.id, recordMap.get(key), value)
                // console.log('res:', res);

                if (langField) {
                  let record = {
                    recordId: recordMap.get(key),
                    fields: {
                      [langField.id]: value,
                    }
                  };
                  recordsToBeUpdate.push(record);
                }
              }
              else {
                // const newKeyCell = await keyField.createCell(key);
                // const newLangCell = await langField.createCell(value);

                // keyCells.push([newKeyCell]);
                // langCells.push([newLangCell]);
                // console.log('langCells:', langCells);

                if (langField && keyField) {
                  let record = {
                    fields: {
                      [keyField.id]: key,
                      [langField.id]: value,
                    }
                  };
                  recordsToBeAdded.push(record);
                }
                // const recordId = await fileTable.addRecord([[newKeyCell],[newLangCell]]);

                // recordMap.set(key, recordId);

                // console.log('New recordId:', recordId);

                // const res = await fileTable.addRecord({
                //   fields: {
                //     [keyField.id]: key,
                //     [langField.id]: value,
                //   }
                // });
                // console.log('Add record:', res);
              }

              console.log('Key:', key);
              console.log('Value:', value);
            }
          }

          console.log('recordsToBeAdded:', recordsToBeAdded.length);
          console.log('recordsToBeUpdate:', recordsToBeUpdate.length);

          // 设置每批次最大记录数
          const MAX_RECORDS_PER_BATCH = 1000;
          // 准备存储所有添加成功的记录ID
          // let allAddedRecordIds = [];

          // 使用循环来分批次更新记录
          for (let i = 0; i < recordsToBeUpdate.length; i += MAX_RECORDS_PER_BATCH) {
            // // 创建一个批次的记录数组，确保不会超出数组界限
            // let batchRecords = recordsToBeUpdate.slice(i, i + MAX_RECORDS_PER_BATCH);

            // 创建一个批次的记录数组，确保不会超出数组界限
            let batchRecords = recordsToBeUpdate.slice(i, i + MAX_RECORDS_PER_BATCH)
              .filter(record => record.recordId !== undefined) // 过滤掉 recordId 为 undefined 的记录
              .map(record => ({ ...record, recordId: record.recordId as string })); // 断言 recordId 为字符串

            currProgress += batchRecords.length;
            updateLoadingProgress($.t('analyze_to_table'), currProgress, totalProgress);

            // 使用 setRecords 方法更新当前批次的记录
            if (batchRecords.length > 0) {
              const res = await fileTable?.setRecords(batchRecords);
              // 将更新成功的记录ID存储起来
              // allAddedRecordIds.push(...res);
            }
          }

          // 使用循环来分批次添加记录
          for (let i = 0; i < recordsToBeAdded.length; i += MAX_RECORDS_PER_BATCH) {
            // 创建一个批次的记录数组，确保不会超出数组界限
            let batchRecords = recordsToBeAdded.slice(i, i + MAX_RECORDS_PER_BATCH);

            currProgress += batchRecords.length;
            updateLoadingProgress($.t('analyze_to_table'), currProgress, totalProgress);

            // 使用 addRecords 方法添加当前批次的记录
            const res = await fileTable?.addRecords(batchRecords);

            // 将添加成功的记录ID存储起来
            // allAddedRecordIds.push(...res);
          }

          // const recordIds = await fileTable.addRecords(records);
          // console.log('recordIds 1:', recordIds);
          // const recordIds = await fileTable.addRecords(records);
          // console.log('recordIds 1:', recordIds);
        }

        console.timeEnd("解析文件时间");

        // 加载完成
        showConfirmation($.t('analyze_to_table_finish'), currProgress, totalProgress);

        updateTableList();
      };

      reader.readAsText(file);

    }
  });

  bitable.base.onTableAdd((event) => {
    console.log('table added')
    updateTableList();
  })

  bitable.base.onTableDelete((event) => {
    console.log('table deleted')
    updateTableList();
  })

  const btnExportFile = document.getElementById('btnExportFile');

  async function updateFieldList(tableId: string) {
    const currTable = await bitable.base.getTableById(tableId!);

    const fieldList = await currTable.getFieldMetaList();

    // console.log('选中的值为:', currTable);

    // console.log('字段列表为:', fieldList);

    $('#fieldLangSelect').empty();

    const fieldOptionsHtml = fieldList.map(field => {
      if (field.name !== KEY_FIELD_NAME) {
        // console.log('字段:', field.id, field.name);
        return `<option value="${field.id}">${field.name}</option>`;
      }
    }).join('');


    // $('#fieldLangSelect').append(fieldOptionsHtml).val(fieldList[0].id!);
    $('#fieldLangSelect').append(fieldOptionsHtml);


    const tableSelect = document.getElementById('tableSelect') as HTMLSelectElement;;
    const fieldLangSelect = document.getElementById('fieldLangSelect') as HTMLSelectElement;;

    fieldLangSelect.selectedIndex = 0;

    // console.log('selectedIndex:', tableSelect.selectedIndex, fieldLangSelect.selectedIndex);

    if (tableSelect.length !== 0 && fieldLangSelect.length !== 0) {
      btnExportFile?.removeAttribute('disabled');
    } else {
      btnExportFile?.setAttribute('disabled', 'true');
    }
  }

  async function updateTableList() {
    const [tableList, tableSelection] = await Promise.all([bitable.base.getTableMetaList(), bitable.base.getSelection()]);
    const tableOptionsHtml = tableList.map(table => {
      return `<option value="${table.id}">${table.name}</option>`;
    }).join('');

    $('#tableSelect').empty();

    if (tableSelection.tableId) {
      $('#tableSelect').append(tableOptionsHtml).val(tableSelection.tableId!);

      updateFieldList(tableSelection.tableId);
    }

    $('#tableSelect').on('change', async function() {
      const tableId = $('#tableSelect').val();

      if (typeof tableId === 'string') {
        console.log('tableId:', tableId);
        updateFieldList(tableId);
      }
    });
  }

  updateTableList();

  // 导出文件
  $('#btnExportFile').on('click', async function() {

    let exportTable = null;
    let exportTableName = null;
    let exportFieldName = null;
    let fileExtension = null;
    let langField = null;
    let keyField = null;
    let currProgress = 0;
    let totalProgress = 0;

    // 显示加载图标
    showLoadingOverlay();

    const tableSelect = document.getElementById('tableSelect') as HTMLSelectElement;;
    const fieldLangSelect = document.getElementById('fieldLangSelect') as HTMLSelectElement;;

    const tableId: string = $('#tableSelect').val() as string;

    exportTableName = tableSelect.options[tableSelect.selectedIndex].text;
    exportFieldName = fieldLangSelect.options[fieldLangSelect.selectedIndex].text;
    fileExtension = getFileExtension(exportTableName);

    console.log('tableSelect:', exportTableName, tableId);

    console.log('fileExtension:', fileExtension);

    //获取数据表
    exportTable = await bitable.base.getTableById(tableId);

    console.log('Get table:', exportTable);

    keyField = await exportTable.getField(KEY_FIELD_NAME);
    console.log('Get key field :', keyField);

    langField = await exportTable.getField(exportFieldName);
    console.log('Get language field :', langField);

    console.time("导出文件时间");

    // 创建一个Map对象(key, value, record id)来存储Record
    const recordMap = new Map<string, string>();
    const recordList = await exportTable.getRecordList();
    const recordIdList = await exportTable.getRecordIdList();
    console.log('Get record list:', recordList, recordIdList);

    currProgress = 0;
    totalProgress = recordIdList.length;
    updateLoadingProgress($.t('export_to_file'), currProgress, totalProgress);

    for (const record of recordList) {
      // const keyCell = await record.getCellByField(keyField);
      // const keyVal = await keyCell.getValue();

      // const langCell = await record.getCellByField(langField);
      // const langVal = await langCell.getValue();

      const keyVal = await exportTable.getCellString(keyField.id, record.id);
      const langVal = await exportTable.getCellString(langField.id, record.id);

      currProgress++;
      updateLoadingProgress($.t('export_to_file'), currProgress, totalProgress);

      // console.log("key lang:", keyVal, langVal);

      if (keyVal && langVal) {
        recordMap.set(keyVal, langVal);

        console.log('get record:', keyVal, langVal);
      }
    }

    let formattedData = "";

    if (fileExtension === ".strings") {
      // 将键值对转换为 "key" = "value" 格式的字符串
      formattedData = Array.from(recordMap.entries()).map(([key, value]) => `"${key}" = "${value}";`).join('\n');

      console.log('format .strings data.');
    } else if (fileExtension === ".xml") {
      formattedData = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n` +
        Array.from(recordMap.entries()).map(([key, value]) => `   <string name="${key}">${value}</string>`).join('\n') +
        `\n</resources>`;
      console.log('format .xml data.');
    }

    console.log(formattedData);

    // 创建Blob对象
    const file: Blob = new Blob([formattedData], { type: fileExtension });

    //console.log("file:", file);

    // 创建URL
    const fileURL: string = URL.createObjectURL(file);

    console.log("fileURL:", fileURL);

    const a = document.getElementById('downloadFile') as HTMLAnchorElement;

    a.href = fileURL;
    a.download = exportTableName;
    a.innerText = $.t('download_file') + exportTableName + " : " + exportFieldName;

    console.timeEnd("导出文件时间");
    // 设置点击事件处理器
    // a.addEventListener('click', () => {
    //     // 设置定时器以清理资源
    //     setTimeout(() => {
    //       console.log("Clean resource:", fileURL);
    //       window.URL.revokeObjectURL(fileURL);
    //     }, 10000); // 例如，10秒后清理
    // });

    // 加载完成
    showConfirmation($.t('export_file_finish'), currProgress, totalProgress);
  });

});


