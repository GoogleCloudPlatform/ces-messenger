import Handlebars from 'handlebars/runtime';
if (Handlebars) window.Handlebars = Handlebars;
(function() {
  var template = Handlebars.template, templates = Handlebars.templates = Handlebars.templates || {};
templates['cesm_button'] = template({"1":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "    background-image: url('"
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"image") || (depth0 != null ? lookupProperty(depth0,"image") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"image","hash":{},"data":data,"loc":{"start":{"line":14,"column":27},"end":{"line":14,"column":36}}}) : helper)))
    + "');\n    padding-left: 65px;\n    background-size: 32px;\n    background-repeat: no-repeat;\n    background-position-x: 20px;\n    background-position-y: 50%;\n";
},"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<style>\n  .cesm-button {\n    position: relative;\n    justify-content: center;\n    width: 100%;\n  }\n\n  .cesm-button button {\n    border-radius: 10px;\n    border: 1px solid #ddd;\n    padding: 15px;\n    font-size: 16px;\n"
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"image") : depth0),{"name":"if","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":13,"column":4},"end":{"line":20,"column":11}}})) != null ? stack1 : "")
    + "    background-color: #fff;\n    color: #666666;\n    font-family: 'Google Sans';\n    cursor: pointer;\n  }\n\n  .cesm-button button:hover {\n    background-color: #eee;\n  }\n</style>\n<div class=\"cesm-button\"><button onclick=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"onclick") || (depth0 != null ? lookupProperty(depth0,"onclick") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"onclick","hash":{},"data":data,"loc":{"start":{"line":31,"column":42},"end":{"line":31,"column":53}}}) : helper)))
    + "\">"
    + alias4(((helper = (helper = lookupProperty(helpers,"text") || (depth0 != null ? lookupProperty(depth0,"text") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"text","hash":{},"data":data,"loc":{"start":{"line":31,"column":55},"end":{"line":31,"column":63}}}) : helper)))
    + "</button></div>\n";
},"useData":true});
templates['cesm_mcq'] = template({"1":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return container.escapeExpression(((helper = (helper = lookupProperty(helpers,"agentMessage") || (depth0 != null ? lookupProperty(depth0,"agentMessage") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"agentMessage","hash":{},"data":data,"loc":{"start":{"line":102,"column":20},"end":{"line":102,"column":36}}}) : helper)));
},"3":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "  <div class=\"mcq-header mcq-title\">"
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"header") || (depth0 != null ? lookupProperty(depth0,"header") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"header","hash":{},"data":data,"loc":{"start":{"line":105,"column":36},"end":{"line":105,"column":46}}}) : helper)))
    + "</div>\n";
},"5":function(container,depth0,helpers,partials,data) {
    var stack1, alias1=depth0 != null ? depth0 : (container.nullContext || {}), lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "    <div class=\"card option-item\"\n"
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"onclick") : depth0),{"name":"if","hash":{},"fn":container.program(6, data, 0),"inverse":container.program(8, data, 0),"data":data,"loc":{"start":{"line":110,"column":6},"end":{"line":118,"column":13}}})) != null ? stack1 : "")
    + "      > \n      <div class=\"option-info\">\n"
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"image") : depth0),{"name":"if","hash":{},"fn":container.program(13, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":121,"column":8},"end":{"line":123,"column":15}}})) != null ? stack1 : "")
    + "        <div class=\"option-details\">\n          <p class=\"option-title\">"
    + container.escapeExpression(container.lambda((depth0 != null ? lookupProperty(depth0,"title") : depth0), depth0))
    + "</p>\n"
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"subtitle") : depth0),{"name":"if","hash":{},"fn":container.program(15, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":126,"column":10},"end":{"line":128,"column":17}}})) != null ? stack1 : "")
    + "        </div>\n      </div>\n    </div>\n";
},"6":function(container,depth0,helpers,partials,data) {
    var lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "        onclick=\""
    + container.escapeExpression(container.lambda((depth0 != null ? lookupProperty(depth0,"onclick") : depth0), depth0))
    + "\"\n";
},"8":function(container,depth0,helpers,partials,data) {
    var stack1, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return ((stack1 = lookupProperty(helpers,"if").call(depth0 != null ? depth0 : (container.nullContext || {}),(depth0 != null ? lookupProperty(depth0,"userMessage") : depth0),{"name":"if","hash":{},"fn":container.program(9, data, 0),"inverse":container.program(11, data, 0),"data":data,"loc":{"start":{"line":113,"column":8},"end":{"line":117,"column":15}}})) != null ? stack1 : "");
},"9":function(container,depth0,helpers,partials,data) {
    var lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "          onclick=\"window.kite.sessionInput('"
    + container.escapeExpression(container.lambda((depth0 != null ? lookupProperty(depth0,"userMessage") : depth0), depth0))
    + "')\"\n";
},"11":function(container,depth0,helpers,partials,data) {
    var lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "          onclick=\"window.kite.sessionInput('"
    + container.escapeExpression(container.lambda((depth0 != null ? lookupProperty(depth0,"title") : depth0), depth0))
    + "')\"\n";
},"13":function(container,depth0,helpers,partials,data) {
    var lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "        <div class=\"option-image\" style=\"background-image: url(&quot;"
    + container.escapeExpression(container.lambda((depth0 != null ? lookupProperty(depth0,"image") : depth0), depth0))
    + "&quot;);\"></div>\n";
},"15":function(container,depth0,helpers,partials,data) {
    var lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "          <p class=\"option-subtitle\">"
    + container.escapeExpression(container.lambda((depth0 != null ? lookupProperty(depth0,"subtitle") : depth0), depth0))
    + "</p>\n";
},"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, alias1=depth0 != null ? depth0 : (container.nullContext || {}), lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<style>\n  .cesm-mcq {\n    font-family: \"Work Sans\", \"Noto Sans\", sans-serif;\n    border-radius: 0.5rem;\n    position: relative;\n    width: 100%;\n    background-color: #F5F5F5;\n    overflow-x: hidden;\n    margin-block-start: 10px;\n    margin-block-end: 10px;\n  }\n\n  .cesm-mcq .card {\n    background-color: #fff;\n    border-radius: 0.5rem;\n    padding: 0.25rem 1rem 0.25rem;\n    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);\n    cursor: pointer;\n  }\n\n .cesm-mcq .card:hover {\n    background-color: #eee;\n  }\n\n  .cesm-mcq .mcq-header {\n    padding: 0.5rem 1rem 0rem;\n  }\n\n  .cesm-mcq .mcq-title {\n    color: #111418;\n    font-size: 1.125rem;\n    line-height: 1.25;\n    font-weight: 700;\n    letter-spacing: -0.015em;\n  }\n\n  .cesm-mcq .options-list {\n    flex: 1 1 0%;\n    overflow-y: auto;\n    padding: 0.5rem;\n  }\n\n  .cesm-mcq .option-item {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: 1rem;\n    margin-top: 0.75rem;\n  }\n\n  .cesm-mcq .option-item:first-child {\n    margin-top: 0;\n  }\n\n  .cesm-mcq .option-info {\n    display: flex;\n    align-items: center;\n    gap: 1rem;\n  }\n\n  .cesm-mcq .option-image {\n    width: 4rem;\n    height: 4rem;\n    aspect-ratio: 1 / 1;\n    border-radius: 0.5rem;\n    background-size: cover;\n    background-position: center;\n    background-repeat: no-repeat;\n  }\n\n  .cesm-mcq .option-details {\n    display: flex;\n    flex-direction: column;\n    justify-content: center;\n  }\n\n.cesm-mcq .option-details p {\n    margin-block-start: 5px;\n    margin-block-end: 5px;\n}\n\n.cesm-mcq .option-title {\n    color: #111418;\n    font-weight: 500;\n    overflow: hidden;\n    display: -webkit-box;\n    -webkit-box-orient: vertical;\n    -webkit-line-clamp: 1;\n  }\n\n  .cesm-mcq .option-subtitle {\n    color: #6b7280;\n    font-size: 0.875rem;\n    line-height: 1.5;\n    overflow: hidden;\n    display: -webkit-box;\n    -webkit-box-orient: vertical;\n    -webkit-line-clamp: 1;\n  }\n</style>\n\n"
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"agentMessage") : depth0),{"name":"if","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":102,"column":0},"end":{"line":102,"column":43}}})) != null ? stack1 : "")
    + "\n<div class=\"cesm-mcq\">\n"
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"header") : depth0),{"name":"if","hash":{},"fn":container.program(3, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":104,"column":2},"end":{"line":106,"column":9}}})) != null ? stack1 : "")
    + "  <div class=\"options-list\">\n"
    + ((stack1 = lookupProperty(helpers,"each").call(alias1,(depth0 != null ? lookupProperty(depth0,"options") : depth0),{"name":"each","hash":{},"fn":container.program(5, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":108,"column":4},"end":{"line":132,"column":13}}})) != null ? stack1 : "")
    + "  </div>\n</div>";
},"useData":true});
})();