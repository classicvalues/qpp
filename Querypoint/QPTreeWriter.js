// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var QPTreeWriter = (function() {
  'use strict';
  
  var debug = false;

  var ParseTreeMapWriter = traceur.outputgeneration.ParseTreeMapWriter;
  var SourceMapGenerator = traceur.outputgeneration.SourceMapGenerator;

  var ParseTreeFactory = traceur.codegeneration.ParseTreeFactory;
  var createIdentifierExpression = ParseTreeFactory.createIdentifierExpression;
  var createMemberExpression = ParseTreeFactory.createMemberExpression;
  var createCallExpression = ParseTreeFactory.createCallExpression;
  var createArgumentList = ParseTreeFactory.createArgumentList;
  var createAssignmentStatement = ParseTreeFactory.createAssignmentStatement;
  var createParenExpression = ParseTreeFactory.createParenExpression;
  var createIdentifierExpression = ParseTreeFactory.createIdentifierExpression;
  var createAssignmentExpression = ParseTreeFactory.createAssignmentExpression;
  var createObjectLiteralExpression = ParseTreeFactory.createObjectLiteralExpression;
  var createPropertyNameAssignment = ParseTreeFactory.createPropertyNameAssignment;
  var createUndefinedExpression = ParseTreeFactory.createUndefinedExpression;

  var Trees = traceur.syntax.trees;
  var CommaExpression = Trees.CommaExpression;
  var ObjectLiteralExpression = Trees.ObjectLiteralExpression;
  var VariableStatement = Trees.VariableStatement;
  var BindingIdentifier = Trees.BindingIdentifier;
  var VariableDeclaration = Trees.VariableDeclaration;
  var VariableDeclarationList = Trees.VariableDeclarationList;
  var ExpressionStatement = Trees.ExpressionStatement;

  var TokenType = traceur.syntax.TokenType;
  var ParseTreeType = traceur.syntax.trees.ParseTreeType;

  // For dev
  var ParseTreeValidator = traceur.syntax.ParseTreeValidator;

  // Constant
  var activationId = '__qp_activation';

    /**
   * Converts a ParseTree to text and a source Map
   * @param {ParseTree} highlighted
   * @param {boolean} showLineNumbers
   * @param { {SourceMapGenerator} sourceMapGenerator
   * @constructor
   */
  function QPTreeWriter(generatedSourceName, tracequeries) {
    var config = {file: generatedSourceName};
    this.sourceMapGenerator = new SourceMapGenerator(config);
    ParseTreeMapWriter.call(this, false, false, this.sourceMapGenerator);
    
    this._tracequeries = tracequeries;
  }


  QPTreeWriter.prototype = traceur.createObject(
    ParseTreeMapWriter.prototype, {
      generateSource: function(file, tree) {
        this.visitAny(tree);
        if (this.currentLine_.length > 0) {
          this.writeln_();
        }
        // TODO looks like this is a method of sourceFile
        file.sourceMap = this.sourceMapGenerator.toString();
        file.generatedSource = this.result_.toString();
        return file;
      },
      
      visitIdentifierExpression: function(tree) {
        // Linearizer has marked the expressions we need to trace with .trace
        if (tree.traceIdentifier) {
          tree = this._traceIdentifierExpression(tree);
          return ParseTreeMapWriter.prototype.visitParenExpression.call(this, tree);
        } 
        return ParseTreeMapWriter.prototype.visitIdentifierExpression.call(this, tree);
      },

      visitFunctionDeclaration: function(tree) {
        // insert the new activation record statements after the function preamble
        this._insertArrayInArray(tree.functionBody.statements, 2, this._createActivationStatements(tree));
        ParseTreeMapWriter.prototype.visitFunctionDeclaration.call(this, tree);
      },

      visitProgram: function(tree) {
        // TODO move the function preamble transform
        for(var i = 0; i < tree.programElements.length; i++) {
          if (tree.programElements[i].type === ParseTreeType.VARIABLE_STATEMENT) break;
        }
        this._insertArrayInArray(tree.programElements, i+1, this._createActivationStatements(tree));
        ParseTreeMapWriter.prototype.visitProgram.call(this, tree);
      },

      _insertArrayInArray: function(container, index, ary) {
        for(var i = 0; i < ary.length; i++) {
          container.splice(index + i, 0, ary[i]);
        }
      },

      _traceIdentifierExpression: function(tree) {
        
        var traceId = tree.traceIdentifier;
        delete tree.traceIdentifier;
        
        // (__qp_activation._offset = window.__qp.trace(__qp_XX))
        var traceExpression = createParenExpression(
          createAssignmentExpression(
            createMemberExpression(
              createIdentifierExpression(activationId),
              traceId
            ),
            createCallExpression(
              createMemberExpression('window', '__qp','trace'),
              createArgumentList(
                tree
              )                    
            )
          )
        );
        
        // (__qp_activation.<offset> = window.__qp.trace(__qp_XX)), __qp_XX
        
        var traceExpression = createParenExpression(
          new CommaExpression(
            tree.location,
            [
              traceExpression,
              tree
            ]  
          )
        );
       
ParseTreeValidator.validate(traceExpression); 
        return traceExpression;
      },

      _createActivationStatements: function(tree) {
        // var activation = {turn: window.__qp.turn};   // used to store traces by offset

        var activationStatement =
          this._varDecl(
            tree.location, 
            activationId, 
            new ObjectLiteralExpression(
              tree.location, 
              [
                createPropertyNameAssignment('turn',
                  createMemberExpression('window', '__qp', 'turn')
                )
              ]
            )
          );
 ParseTreeValidator.validate(activationStatement);

        // __qp_function.push(activation),; 
        var pushExpression = 
          createCallExpression(
            createMemberExpression(
              createIdentifierExpression('__qp_function'),
              'push'
            ),
            createArgumentList(
              createIdentifierExpression(activationId)
            )
          );
        
        // We need to suppress the return value of the push() 
        var pushStatement = this._postPendComma(tree.location, pushExpression);
ParseTreeValidator.validate(pushStatement);
        return [activationStatement, pushStatement];
      },
      
      _postPendComma: function(loc, tree, value) {
          return new ExpressionStatement(loc, 
            new CommaExpression(loc, [tree, value || createUndefinedExpression()])
          );
      },

      _varDecl: function(loc, id, tree) {
        return new VariableStatement(loc, 
          new VariableDeclarationList(loc, TokenType.VAR, 
            [new VariableDeclaration(loc, 
                 new BindingIdentifier(loc, id), 
                 tree
            )]
          )
        );
      },
      
  });

  return QPTreeWriter;

})();