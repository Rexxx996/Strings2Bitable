import $ from 'jquery';
import { bitable, FieldType } from '@lark-base-open/js-sdk';
import './index.scss';
import './locales/i18n'; // 开启国际化，详情请看README.md

function showLoadingOverlay() {
  document.getElementById('loadingOverlay').style.display = 'flex';
  document.getElementById('loadEndOverlay').style.display = 'none';
}

function hideOverlay() {
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('loadEndOverlay').style.display = 'none';
}

function updateLoadingProgress(statusText, current, total) {
  const progressText = statusText + `${current}/${total}`;
  document.getElementById('loadingStatus').innerText = `${progressText}`;
}

function updateAnalyzeProgress(statusText, current, total) {
  const progressText = statusText + `${current}/${total}`;
  document.getElementById('loadingStatus').innerText = `${progressText}`;
}

function showConfirmation(statusText, current, total) {
  const progressText = statusText + `${current}/${total}`;
  document.getElementById('loadEndStatus').innerText = `${progressText}`;
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('loadEndOverlay').style.display = 'flex';

  document.getElementById('btnConfirm').focus();
}

$('#btnConfirm').on('click', async function() {
  hideOverlay();
});

$(async function() {

  const KEY_FIELD_NAME = "key";

  // console.log($.t('title')) // '这是中文标题'

  // 监听选择文件
  const inputFile = document.getElementById('inputFile');
  const inputLang = document.getElementById('inputLang');
  const btnAnalyzeFile = document.getElementById('btnAnalyzeFile');

  inputFile.addEventListener('change', updateButtonState);
  inputLang.addEventListener('input', updateButtonState);

  function updateButtonState() {
    if (inputFile.files.length > 0 && inputLang.value.trim() !== '') {
      btnAnalyzeFile.removeAttribute('disabled');
    } else {
      btnAnalyzeFile.setAttribute('disabled', true);
    }
  }

  // 解析文件
  $('#btnAnalyzeFile').on('click', async function() {
    // btnAnalyzeFile.addEventListener('click', async function() {

    // 显示加载图标
    showLoadingOverlay();

    const file = inputFile.files[0];
    if (file) {

      console.log('Input File:', file.name);
      console.log('Input Language:', inputLang.value)

      let fileTable = null;
      let fileTableIndex = null;
      let result = null;
      let langField = null;
      let keyField = null;
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
              name: inputLang.value,
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
        console.log('Key field is exist.', keyField);
      }

      keyField = await fileTable.getFieldByName<ITextFieldConfig>(KEY_FIELD_NAME);
      console.log('Get key field :', keyField);

      //获取/创建语言字段
      try {

        await fileTable.addField({ name: inputLang.value, type: FieldType.Text });

      } catch (error) {

        console.log('Language field is exist.', langField);
      }

      langField = await fileTable.getFieldByName<ITextFieldConfig>(inputLang.value);
      console.log('Get language field :', langField);

      // 创建一个Map对象(key, value, record id)来存储Record
      const recordMap = new Map<string, string>();
      const recordList = await fileTable.getRecordList();
      console.log('Get record list:', recordList, recordList.recordIdList.length);

      currProgress = 0;
      totalProgress = recordList.recordIdList.length;
      updateLoadingProgress($.t('loading_table'), currProgress, totalProgress);

      for (const record of recordList) {
        const keyCell = await record.getCellByField(keyField);
        const keyVal = await keyCell.getValue();

        currProgress++;
        updateLoadingProgress($.t('loading_table'), currProgress, totalProgress);

        // const langCell = await record.getCellByField(langField);
        // const langVal = await langCell.getValue();

        console.log("key Val:", keyVal);

        if (keyVal) {
          recordMap.set(keyVal[0].text, record.id);

          console.log('get record:', keyVal[0].text, ' ', record.id);
        }
        // else
        // {
        //   // 删除空行
        //   await fileTable.deleteRecord(record);
        // }
      }

      const reader = new FileReader();

      reader.onload = async function(event) {
        const fileContent = event.target.result;
        // 使用正则表达式提取"key"和"value"
        const keyValuePairs = fileContent.match(/"([^"]+)"\s*=\s*"([^"]+)"/g);

        console.log('keyValuePairs:', keyValuePairs.length);

        currProgress = 0;
        totalProgress = keyValuePairs.length;
        updateLoadingProgress($.t('analyze_to_table'), currProgress, totalProgress);

        if (keyValuePairs) {
          for (const pair of keyValuePairs) {
            const matches = pair.match(/"([^"]+)"\s*=\s*"([^"]+)"/);
            if (matches) {
              const key = matches[1];
              const value = matches[2];

              currProgress++;
              updateLoadingProgress($.t('analyze_to_table'), currProgress, totalProgress);

              if (recordMap.has(key)) {
                console.log('setCellValue:', langField.id, recordMap.get(key), value);

                const res = await fileTable.setCellValue(langField.id, recordMap.get(key), value)
                console.log('res:', res);
              }
              else {
                // const newKeyCell = await keyField.createCell(key);
                // const newLangCell = await langField.createCell(value);

                // const recordId = await fileTable.addRecord([[newKeyCell],[newLangCell]]);

                // recordMap.set(key, recordId);

                // console.log('New recordId:', recordId);

                const res = await fileTable.addRecord({
                  fields: {
                    [keyField.id]: key,
                    [langField.id]: value,
                  }
                });
                console.log('Add record:', res);
              }

              console.log('Key:', key);
              console.log('Value:', value);
            }
          }
        }

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
      if (field.name !== KEY_FIELD_NAME)
      {
        // console.log('字段:', field.id, field.name);
        return `<option value="${field.id}">${field.name}</option>`;
      }
    }).join('');

    
    // $('#fieldLangSelect').append(fieldOptionsHtml).val(fieldList[0].id!);
    $('#fieldLangSelect').append(fieldOptionsHtml);


    const tableSelect = document.getElementById('tableSelect');
    const fieldLangSelect = document.getElementById('fieldLangSelect');

    fieldLangSelect.selectedIndex = 0;
    
    // console.log('selectedIndex:', tableSelect.selectedIndex, fieldLangSelect.selectedIndex);
    
    if (tableSelect.length  !== 0 && fieldLangSelect.length !== 0) {
      btnExportFile.removeAttribute('disabled');
    } else {
      btnExportFile.setAttribute('disabled', true);
    }
  }

  async function updateTableList() {
    const [tableList, tableSelection] = await Promise.all([bitable.base.getTableMetaList(), bitable.base.getSelection()]);
    const tableOptionsHtml = tableList.map(table => {
      return `<option value="${table.id}">${table.name}</option>`;
    }).join('');

    $('#tableSelect').empty();
    
    $('#tableSelect').append(tableOptionsHtml).val(tableSelection.tableId!);

    updateFieldList(tableSelection.tableId);

    $('#tableSelect').on('change', async function() {
      const tableId = $('#tableSelect').val();

      console.log('tableId:', tableId);
      updateFieldList(tableId);
    });
  }

  updateTableList();

  // 导出文件
  $('#btnExportFile').on('click', async function() {

    let exportTable = null;
    let exportTableName = null;
    let exportFieldName = null;
    let result = null;
    let langField = null;
    let keyField = null;
    let currProgress = 0;
    let totalProgress = 0;
    
    // 显示加载图标
    showLoadingOverlay();

    const tableId = $('#tableSelect').val();

    exportTableName = tableSelect.options[tableSelect.selectedIndex].text;
    exportFieldName = fieldLangSelect.options[fieldLangSelect.selectedIndex].text;

    console.log('tableSelect:', exportTableName, tableId);
    
    //获取数据表
    exportTable = await bitable.base.getTableById(tableId);

    console.log('Get table:', exportTable);

    keyField = await exportTable.getFieldByName<ITextFieldConfig>(KEY_FIELD_NAME);
    console.log('Get key field :', keyField);

    langField = await exportTable.getFieldByName<ITextFieldConfig>(exportFieldName);
    console.log('Get language field :', langField);

    // 创建一个Map对象(key, value, record id)来存储Record
    const recordMap = new Map<string, string>();
    const recordList = await exportTable.getRecordList();

    console.log('Get record list:', recordList, recordList.recordIdList.length);

    currProgress = 0;
    totalProgress = recordList.recordIdList.length;
    updateLoadingProgress($.t('loading_table'), currProgress, totalProgress);

    for (const record of recordList) {
      const keyCell = await record.getCellByField(keyField);
      const keyVal = await keyCell.getValue();

      const langCell = await record.getCellByField(langField);
      const langVal = await langCell.getValue();
      
      currProgress++;
      updateLoadingProgress($.t('loading_table'), currProgress, totalProgress);

      // console.log("key lang:", keyVal, langVal);

      if (keyVal) {
        recordMap.set(keyVal[0].text, langVal[0].text);

        console.log('get record:', keyVal[0].text, langVal[0].text);
      }
    }

    // 将键值对转换为 "key" = "value" 格式的字符串
    const formattedData: string = Array.from(recordMap.entries()).map(([key, value]) => `"${key}" = "${value}"`).join('\n');

    console.log(formattedData);
    
    // 创建Blob对象
    const file: Blob = new Blob([formattedData], {type: ".strings"});

    console.log("file:", file);

    // 创建URL
    const fileURL: string = URL.createObjectURL(file);

    console.log("fileURL:", fileURL);

    const a = document.getElementById('downloadFile');

    a.href = fileURL;
    a.download = exportTableName;
    a.innerText = $.t('download_file') + exportTableName + " : " + exportFieldName;

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


